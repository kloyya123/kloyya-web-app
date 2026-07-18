import type { AppDb } from '@kloyya/db';
import type { StartContext } from '../integrations/connect.js';
import { AiError, type AiProvider } from '../ai/provider.js';
import { retrieveContext, type RetrievedRecord } from './retrieval.js';

/**
 * Ask Kloyya.
 *
 * The shape is deliberately small: find the records that bear on the question,
 * hand them to the model with an instruction to answer *only* from them and to
 * say so when they don't cover it, and return the answer beside the exact
 * sources it was allowed to use. The product's first principle — never assert
 * without evidence, never hide uncertainty — is enforced here in the prompt and
 * in the fact that the citations are the retrieved records, not something the
 * model was free to invent.
 */
export interface Citation {
  /** A friendly source name, e.g. "Gmail" or "Notion". */
  source: string;
  resourceType: string;
  label: string;
  /** ISO timestamp of when Kloyya last read this — the answer's freshness. */
  freshness: string;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  /** "openai:gpt-4o-mini" — which model answered, for the trust surface. */
  model: string;
}

export type AskOutcome =
  | { ok: true; result: AskResult }
  | { ok: false; reason: 'not_configured' | 'unavailable' };

const SYSTEM_PROMPT = [
  'You are Kloyya, an AI chief of staff. You answer questions using ONLY the',
  'context provided below, which is drawn from the user’s own connected tools.',
  'Rules, in order of importance:',
  '1. Never state anything the context does not support. If the context does not',
  '   answer the question, say plainly that you could not find it in their',
  '   connected tools — do not guess or use outside knowledge.',
  '2. Be direct and concise. Lead with the answer, then the brief support.',
  '3. When you use a piece of context, refer to it naturally (e.g. "your',
  '   Standup notes email"). Do not fabricate sources, dates, or names.',
  '4. If the context is empty, say you have nothing connected yet that covers',
  '   this, and suggest connecting the relevant tool.',
].join('\n');

/** Turn one integration id into a name a person recognises. */
function sourceName(integrationId: string): string {
  const known: Record<string, string> = {
    gmail: 'Gmail',
    outlook: 'Outlook',
    google_calendar: 'Google Calendar',
    outlook_calendar: 'Outlook Calendar',
    google_drive: 'Google Drive',
    notion: 'Notion',
    uploaded_documents: 'Uploaded Documents',
  };
  return known[integrationId] ?? integrationId.replace(/_/g, ' ');
}

function toCitation(record: RetrievedRecord): Citation {
  return {
    source: sourceName(record.integrationId),
    resourceType: record.resourceType,
    label: record.label,
    freshness: record.fetchedAt.toISOString(),
  };
}

/** Build the user turn: the question, then the evidence it may draw on. */
function buildUserMessage(question: string, records: RetrievedRecord[]): string {
  if (records.length === 0) {
    return [
      `Question: ${question}`,
      '',
      'Context: (nothing in the connected tools matched this question).',
    ].join('\n');
  }

  const context = records
    .map((record, index) => {
      // A bounded excerpt — enough to answer from, not the whole object.
      const excerpt = JSON.stringify(record.payload).slice(0, 600);
      return [
        `[${index + 1}] Source: ${sourceName(record.integrationId)} — ${record.label}`,
        `    ${excerpt}`,
      ].join('\n');
    })
    .join('\n\n');

  return [`Question: ${question}`, '', 'Context from the user’s connected tools:', context].join(
    '\n',
  );
}

export async function ask(
  db: AppDb,
  ctx: StartContext,
  question: string,
  provider: AiProvider | null,
  fetchImpl?: typeof fetch,
): Promise<AskOutcome> {
  // No key for the selected provider: the honest "not set up" answer.
  if (!provider) return { ok: false, reason: 'not_configured' };

  const records = await retrieveContext(db, ctx, question);

  try {
    const { text } = await provider.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(question, records) }],
      maxTokens: 800,
      ...(fetchImpl ? { fetchImpl } : {}),
    });

    return {
      ok: true,
      result: {
        answer: text.trim(),
        citations: records.map(toCitation),
        model: `${provider.name}:${provider.model}`,
      },
    };
  } catch (error) {
    // The provider was configured but unreachable — a 503, not a broken query.
    if (error instanceof AiError) return { ok: false, reason: 'unavailable' };
    throw error;
  }
}
