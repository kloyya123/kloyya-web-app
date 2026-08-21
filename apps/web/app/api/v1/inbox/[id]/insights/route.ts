import { errors } from '@server/http/errors';
import { kasRoute } from '@server/http/handler';

/**
 * Per-thread AI insights (suggested replies, extracted tasks, detected
 * meetings) — not built yet. Every thread 404s here, which is the same
 * absent-is-valid contract the interface already documents for routine mail;
 * today it is simply true of all mail, not just the routine kind. Replace the
 * body once a real triage pipeline exists — the route and its contract stay.
 */
export const GET = kasRoute('verified', async () => {
  throw errors.notFound('Email insights');
});
