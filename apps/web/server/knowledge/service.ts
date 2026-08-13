import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { documents } from '@kloyya/db/schema';
import type { AiProvider } from '../ai/provider';
import { AiError } from '../ai/provider';
import { errors } from '../http/errors';
import type { StartContext } from '../tenant';
import type { KnowledgeArticle } from '@/types/domain';
import type { ArticleDetail, ArticleFilter, ArticleList, KnowledgeGraph } from '@/types/knowledge';

/**
 * Knowledge, v1: the workspace's own uploaded documents, treated as articles.
 *
 * Deliberately narrower than the full spec. `KnowledgeArticle.aiSummary` is
 * documented as an AI-generated summary — an ACTUAL model call, cached on the
 * row (see the `ai_summary*` columns, migration 0030), same reasoning as
 * `briefings`: a summary that reworded itself on every refresh would be
 * harder to trust than a stable one. When no provider is configured, or
 * generation fails, `aiSummary` falls back to a plain excerpt of the
 * extracted text — an honestly-labeled stand-in, the same move
 * `server/inbox/service.ts` makes for `EmailThread.aiSummary` with Gmail's
 * own snippet, not a fabricated claim of analysis that didn't happen.
 *
 * `getGraph()` returns an honestly empty graph. Building a real one means
 * extracting entities and relationships (who owns what, who attended what,
 * what decision blocks what task) from email, calendar and documents — a
 * real NLP pipeline, not a data-source swap, and a wrong inferred
 * relationship shown as fact is a worse failure than an empty graph. That is
 * follow-on work, not this pass.
 */

const EXCERPT_CHARS = 240;
const AI_GENERATED_CONFIDENCE = 80;
const EXCERPT_FALLBACK_CONFIDENCE = 20;
/**
 * How many uncached summaries a single `listArticles` call will generate.
 *
 * Each one is a real, serial model call — with NVIDIA's hosted model, tens of
 * seconds apiece. A workspace with several freshly uploaded documents would
 * otherwise summarize all of them in one request and blow well past the
 * route's own `maxDuration`. This is read-through/cached (see module doc), so
 * capping it here only defers the rest to the next load rather than skipping
 * them — the next call picks up where this one left off.
 */
const MAX_SUMMARIES_PER_LIST_CALL = 1;

const CATEGORY_BY_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'text/plain': 'Text',
  'text/markdown': 'Text',
  'text/csv': 'Spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Spreadsheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentation',
  'image/png': 'Image',
  'image/jpeg': 'Image',
};

function categoryFor(mimeType: string): string {
  return CATEGORY_BY_MIME[mimeType] ?? 'Document';
}

function excerptOf(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, EXCERPT_CHARS).trimEnd()}…`;
}

const SUMMARY_SYSTEM_PROMPT = [
  'You summarize one uploaded document in two or three plain sentences.',
  'Say what the document is and its most important points. No preamble,',
  'no "this document discusses" framing — just the substance. If the text',
  'is too short or unclear to summarize meaningfully, say so plainly rather',
  'than inventing content.',
].join('\n');

interface DocumentRow {
  id: string;
  name: string;
  mimeType: string;
  extractedText: string;
  uploadedByUserId: string | null;
  aiSummary: string | null;
  aiSummaryConfidence: number | null;
  createdAt: Date;
  updatedAt: Date;
}

async function summarize(provider: AiProvider, name: string, text: string): Promise<string | null> {
  try {
    const { text: summary } = await provider.complete({
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Document: ${name}\n\n${text.slice(0, 6000)}` }],
      maxTokens: 200,
    });
    return summary.trim() || null;
  } catch (error) {
    if (error instanceof AiError) return null;
    throw error;
  }
}

/**
 * Fills in `aiSummary`/`aiSummaryConfidence` for rows that don't have one
 * cached yet, generating and persisting as it goes. Read-through, same shape
 * as `generateBriefing` — the first read of a new document pays the model
 * call, every later one is a row read.
 */
async function ensureSummaries(
  db: AppDb,
  ctx: StartContext,
  rows: DocumentRow[],
  provider: AiProvider | null,
  maxGenerations = Infinity,
): Promise<DocumentRow[]> {
  const result: DocumentRow[] = [];
  let generations = 0;
  for (const row of rows) {
    if (row.aiSummary !== null || row.extractedText.trim().length === 0 || generations >= maxGenerations) {
      result.push(row);
      continue;
    }
    generations += 1;

    const generated = provider ? await summarize(provider, row.name, row.extractedText) : null;
    const aiSummary = generated ?? excerptOf(row.extractedText);
    const aiSummaryConfidence = generated ? AI_GENERATED_CONFIDENCE : EXCERPT_FALLBACK_CONFIDENCE;

    await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx
        .update(documents)
        .set({ aiSummary, aiSummaryConfidence, aiSummarizedAt: new Date() })
        .where(and(eq(documents.id, row.id), eq(documents.workspaceId, ctx.workspaceId))),
    );

    result.push({ ...row, aiSummary, aiSummaryConfidence });
  }
  return result;
}

function toArticle(row: DocumentRow, ctx: StartContext): KnowledgeArticle {
  return {
    id: row.id,
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    createdBy: row.uploadedByUserId ?? '',
    updatedBy: row.uploadedByUserId ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: 1,
    title: row.name,
    category: categoryFor(row.mimeType),
    aiSummary: row.aiSummary ?? excerptOf(row.extractedText),
    // No real tagging exists yet — an empty list is honest, an invented one is not.
    tags: [],
    authorId: row.uploadedByUserId ?? '',
    confidence: row.aiSummaryConfidence ?? EXCERPT_FALLBACK_CONFIDENCE,
  };
}

async function loadDocumentRows(db: AppDb, ctx: StartContext): Promise<DocumentRow[]> {
  return withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        id: documents.id,
        name: documents.name,
        mimeType: documents.mimeType,
        extractedText: documents.extractedText,
        uploadedByUserId: documents.uploadedByUserId,
        aiSummary: documents.aiSummary,
        aiSummaryConfidence: documents.aiSummaryConfidence,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, ctx.workspaceId),
          eq(documents.status, 'ready'),
          isNull(documents.deletedAt),
        ),
      )
      .orderBy(desc(documents.createdAt)),
  );
}

export async function listArticles(
  db: AppDb,
  ctx: StartContext,
  provider: AiProvider | null,
  filter?: ArticleFilter,
): Promise<ArticleList> {
  const rows = await ensureSummaries(
    db,
    ctx,
    await loadDocumentRows(db, ctx),
    provider,
    MAX_SUMMARIES_PER_LIST_CALL,
  );
  let articles = rows.map((row) => toArticle(row, ctx));

  if (filter?.category) articles = articles.filter((a) => a.category === filter.category);
  if (filter?.tag) articles = articles.filter((a) => a.tags.includes(filter.tag!));

  const categories = [...new Set(rows.map((row) => categoryFor(row.mimeType)))].sort();
  return { articles, categories, totalCount: articles.length };
}

export async function getArticle(
  db: AppDb,
  ctx: StartContext,
  provider: AiProvider | null,
  id: string,
): Promise<ArticleDetail> {
  const rows = await loadDocumentRows(db, ctx);
  const row = rows.find((r) => r.id === id);
  if (!row) throw errors.notFound('Article');

  const [summarized] = await ensureSummaries(db, ctx, [row], provider);
  return {
    ...toArticle(summarized!, ctx),
    body: row.extractedText,
    // No knowledge graph exists yet — see module doc.
    relatedNodeIds: [],
  };
}

/** Honestly empty — see module doc for why a real graph is follow-on work. */
export async function getGraph(): Promise<KnowledgeGraph> {
  return { nodes: [], edges: [] };
}
