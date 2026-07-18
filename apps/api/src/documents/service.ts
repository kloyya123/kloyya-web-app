import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { documents } from '@kloyya/db/schema';
import type { StartContext } from '../integrations/connect.js';

/**
 * Uploaded documents — metadata CRUD.
 *
 * The bytes live in object storage; this manages the rows. Everything runs inside
 * the tenant scope, so RLS guarantees a workspace only ever sees its own files.
 * `extractedText` and `storagePath` never leave the server in a list — the DTO
 * carries only what the UI shows.
 */
export interface DocumentDto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
}

function toDto(row: {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: 'processing' | 'ready' | 'failed';
  createdAt: Date;
}): DocumentDto {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The workspace's live documents, newest first. */
export async function listDocuments(db: AppDb, ctx: StartContext): Promise<DocumentDto[]> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        id: documents.id,
        name: documents.name,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        status: documents.status,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(and(eq(documents.workspaceId, ctx.workspaceId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt)),
  );
  return rows.map(toDto);
}

/** How many live documents the workspace keeps — what the plan cap reads. */
export async function countDocuments(db: AppDb, ctx: StartContext): Promise<number> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({ n: count() })
      .from(documents)
      .where(and(eq(documents.workspaceId, ctx.workspaceId), isNull(documents.deletedAt))),
  );
  return rows[0]?.n ?? 0;
}

export interface NewDocument {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  extractedText: string;
  uploadedByUserId: string;
}

/** Land a stored+extracted document. Status is `ready` — the bytes are already up. */
export async function createDocument(
  db: AppDb,
  ctx: StartContext,
  doc: NewDocument,
): Promise<DocumentDto> {
  const [row] = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .insert(documents)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        uploadedByUserId: doc.uploadedByUserId,
        name: doc.name,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        storagePath: doc.storagePath,
        extractedText: doc.extractedText,
        status: 'ready',
      })
      .returning({
        id: documents.id,
        name: documents.name,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        status: documents.status,
        createdAt: documents.createdAt,
      }),
  );
  return toDto(row!);
}

/**
 * Soft-delete a document, returning its storage path so the caller can remove the
 * bytes. Returns null when there's nothing to delete (already gone, or not ours —
 * RLS makes "not ours" indistinguishable from "not found", which is correct).
 */
export async function deleteDocument(
  db: AppDb,
  ctx: StartContext,
  id: string,
): Promise<{ storagePath: string } | null> {
  const [row] = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(documents.workspaceId, ctx.workspaceId),
          eq(documents.id, id),
          isNull(documents.deletedAt),
        ),
      )
      .returning({ storagePath: documents.storagePath }),
  );
  return row ?? null;
}
