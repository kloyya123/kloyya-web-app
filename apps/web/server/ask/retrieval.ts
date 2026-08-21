import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { documents, syncRecords } from '@kloyya/db/schema';
import type { StartContext } from '../integrations/connect';

/**
 * Finding the handful of landed records that bear on a question.
 *
 * Retrieval v1 is Postgres full-text over the raw provider JSON in sync_records —
 * no vector store, no embeddings. `plainto_tsquery` tokenises the question and
 * ANDs the terms; a record matches when its payload, cast to text, contains them.
 * It is not semantic, but at beta scale it is fast, free, and good enough to put
 * real evidence under an answer. pgvector is the clean later upgrade.
 *
 * The query runs inside the tenant scope, so RLS guarantees only this workspace's
 * records can come back even if the WHERE forgot to say so — and tombstoned rows
 * (provider-deleted) are excluded, because "here's a meeting that was cancelled"
 * is a bad citation.
 */
export interface RetrievedRecord {
  integrationId: string;
  resourceType: string;
  externalId: string;
  payload: unknown;
  fetchedAt: Date;
  /** A short human label derived from the payload, for the citation. */
  label: string;
}

/** The most a single answer draws on. More context rarely helps and costs tokens. */
const DEFAULT_LIMIT = 8;

export async function retrieveContext(
  db: AppDb,
  ctx: StartContext,
  question: string,
  limit = DEFAULT_LIMIT,
): Promise<RetrievedRecord[]> {
  return withTenantScope(db, ctx.organizationId, async (tx) => {
    // Connected-tool data: full-text over the raw provider JSON.
    const synced = await tx
      .select({
        integrationId: syncRecords.integrationId,
        resourceType: syncRecords.resourceType,
        externalId: syncRecords.externalId,
        payload: syncRecords.payload,
        fetchedAt: syncRecords.fetchedAt,
      })
      .from(syncRecords)
      .where(
        and(
          eq(syncRecords.workspaceId, ctx.workspaceId),
          isNull(syncRecords.deletedAtSource),
          sql`to_tsvector('english', ${syncRecords.payload}::text) @@ plainto_tsquery('english', ${question})`,
        ),
      )
      .orderBy(desc(syncRecords.fetchedAt))
      .limit(limit);

    // Uploaded documents: full-text over the extracted text and the filename, so a
    // PDF searchable only by its name still surfaces. Presented as one more source.
    const uploaded = await tx
      .select({
        id: documents.id,
        name: documents.name,
        text: documents.extractedText,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, ctx.workspaceId),
          isNull(documents.deletedAt),
          sql`to_tsvector('english', ${documents.extractedText} || ' ' || ${documents.name}) @@ plainto_tsquery('english', ${question})`,
        ),
      )
      .orderBy(desc(documents.createdAt))
      .limit(limit);

    const records: RetrievedRecord[] = [
      ...synced.map((row) => ({
        integrationId: row.integrationId,
        resourceType: row.resourceType,
        externalId: row.externalId,
        payload: row.payload,
        fetchedAt: row.fetchedAt,
        label: describe(row.payload, row.resourceType),
      })),
      ...uploaded.map((row) => ({
        integrationId: 'uploaded_documents',
        resourceType: 'document',
        externalId: row.id,
        payload: { name: row.name, text: row.text.slice(0, 2000) },
        fetchedAt: row.createdAt,
        label: row.name,
      })),
    ];

    // Newest first across both sources, capped to what one answer should carry.
    return records.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime()).slice(0, limit);
  });
}

/**
 * A one-line label for a raw provider object.
 *
 * Every provider names the human-facing thing differently — Gmail uses
 * `subject`, Drive/Notion use `name`/`title`, calendars use `summary`/`subject`.
 * We try the common keys and fall back to the resource type, never dumping raw
 * JSON at a person.
 */
export function describe(payload: unknown, resourceType: string): string {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    for (const key of ['subject', 'title', 'name', 'summary']) {
      const value = p[key];
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
  }
  return resourceType.replace(/_/g, ' ');
}
