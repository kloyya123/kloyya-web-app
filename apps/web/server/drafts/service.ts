import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { drafts } from '@kloyya/db/schema';
import type { StartContext } from '../integrations/connect';

/**
 * Drafts.
 *
 * Create, list, read, autosave, archive, delete — the whole life of an unfinished
 * piece of writing. Everything is workspace-scoped inside the tenant boundary, so
 * RLS guarantees one workspace never sees another's drafts even if a query forgot
 * to say so.
 *
 * Delete is a SOFT delete (`deletedAt`), because "I didn't mean to delete that"
 * is a thing that happens to half-written email; the row stays, filtered out of
 * every read. Archive is different — a draft you meant to keep but set aside.
 */
export const DRAFT_TYPES = ['email', 'note', 'report', 'document', 'meeting_summary'] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export const DRAFT_STATUSES = ['active', 'archived'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export interface Draft {
  id: string;
  type: DraftType;
  title: string;
  body: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
}

/** The columns a Draft DTO is built from — selected everywhere, mapped once. */
const draftColumns = {
  id: drafts.id,
  type: drafts.type,
  title: drafts.title,
  body: drafts.body,
  status: drafts.status,
  createdAt: drafts.createdAt,
  updatedAt: drafts.updatedAt,
};

type DraftRow = {
  id: string;
  type: DraftType;
  title: string;
  body: string;
  status: DraftStatus;
  createdAt: Date;
  updatedAt: Date;
};

function toDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface ListDraftsQuery {
  status?: DraftStatus | undefined;
  type?: DraftType | undefined;
}

export async function listDrafts(
  db: AppDb,
  ctx: StartContext,
  query: ListDraftsQuery = {},
): Promise<Draft[]> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select(draftColumns)
      .from(drafts)
      .where(
        and(
          eq(drafts.workspaceId, ctx.workspaceId),
          isNull(drafts.deletedAt),
          ...(query.status ? [eq(drafts.status, query.status)] : []),
          ...(query.type ? [eq(drafts.type, query.type)] : []),
        ),
      )
      // Most recently touched first — resume where you left off.
      .orderBy(desc(drafts.updatedAt)),
  );
  return rows.map(toDraft);
}

export async function getDraft(db: AppDb, ctx: StartContext, id: string): Promise<Draft | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select(draftColumns)
      .from(drafts)
      .where(
        and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.id, id), isNull(drafts.deletedAt)),
      )
      .limit(1),
  );
  return rows[0] ? toDraft(rows[0]) : null;
}

export interface CreateDraftInput {
  type: DraftType;
  title?: string | undefined;
  body?: string | undefined;
}

export async function createDraft(
  db: AppDb,
  ctx: StartContext,
  input: CreateDraftInput,
): Promise<Draft> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .insert(drafts)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        authorId: ctx.userId,
        type: input.type,
        title: input.title ?? '',
        body: input.body ?? '',
      })
      .returning(draftColumns),
  );
  return toDraft(rows[0]!);
}

export interface UpdateDraftInput {
  title?: string | undefined;
  body?: string | undefined;
  type?: DraftType | undefined;
  status?: DraftStatus | undefined;
}

/**
 * Autosave, and archive. A patch: only the fields present change. Bumping
 * `updatedAt` is what keeps the list ordered by "most recently worked on", so it
 * is set on every save even when only the body moved.
 */
export async function updateDraft(
  db: AppDb,
  ctx: StartContext,
  id: string,
  patch: UpdateDraftInput,
): Promise<Draft | null> {
  const set = {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };
  // Nothing to change is a read, not an error.
  if (Object.keys(set).length === 0) return getDraft(db, ctx, id);

  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .update(drafts)
      .set(set)
      .where(
        and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.id, id), isNull(drafts.deletedAt)),
      )
      .returning(draftColumns),
  );
  return rows[0] ? toDraft(rows[0]) : null;
}

/** Soft delete — the row stays, filtered from every read, recoverable. */
export async function deleteDraft(db: AppDb, ctx: StartContext, id: string): Promise<boolean> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .update(drafts)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.id, id), isNull(drafts.deletedAt)),
      )
      .returning({ id: drafts.id }),
  );
  return rows.length > 0;
}
