import { count, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { feedback } from '@kloyya/db/schema';
import type { FeedbackCategory, FeedbackSummary, FeedbackType } from '@kloyya/core/feedback';
import type { StartContext } from '../tenant';

/**
 * Beta feedback — submit and tally.
 *
 * Kloyya is built alongside its users; this records their ideas and problems and
 * counts them for the "you've submitted N" panel. Everything is workspace-scoped
 * through the tenant boundary, so one workspace's feedback and counts are never
 * another's.
 */
export interface FeedbackInput {
  type: FeedbackType;
  title: string;
  body: string;
  category?: FeedbackCategory | undefined;
  rating?: number | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface FeedbackReceipt {
  id: string;
  type: FeedbackType;
  createdAt: string;
}

export async function submitFeedback(
  db: AppDb,
  ctx: StartContext,
  input: FeedbackInput,
): Promise<FeedbackReceipt> {
  const [row] = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .insert(feedback)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        ...(input.category ? { category: input.category } : {}),
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.details ? { details: input.details } : {}),
      })
      .returning({ id: feedback.id, type: feedback.type, createdAt: feedback.createdAt }),
  );
  return { id: row!.id, type: row!.type, createdAt: row!.createdAt.toISOString() };
}

/** The running tallies for the beta-status panel. */
export async function feedbackSummary(db: AppDb, ctx: StartContext): Promise<FeedbackSummary> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({ type: feedback.type, n: count() })
      .from(feedback)
      .where(eq(feedback.workspaceId, ctx.workspaceId))
      .groupBy(feedback.type),
  );

  const by = (t: FeedbackType) => rows.find((r) => r.type === t)?.n ?? 0;
  const featureRequests = by('feature_request');
  const bugsReported = by('bug');
  const generalFeedback = by('general');
  return {
    featureRequests,
    bugsReported,
    generalFeedback,
    total: featureRequests + bugsReported + generalFeedback,
  };
}
