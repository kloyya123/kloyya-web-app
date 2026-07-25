import { randomUUID } from 'node:crypto';
import { entitlementsFor, withinLimit } from '@kloyya/core';
import type { AppDb } from '@kloyya/db/client';
import { config } from '../config';
import { API_STATUS, ApiError } from '../http/errors';
import { readTier } from '../plan/tier';
import { resolveStorageProvider, type StorageProvider } from '../storage/provider';
import type { StartContext } from '../tenant';
import { countDocuments } from './service';

/** The hard cap on a single upload. Vercel's body limit is separate (~4.5MB) and
 *  is exactly why the signed-URL path exists — it lifts uploads past it to here. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Keep a storage path predictable and safe from a hostile filename. */
export function safeName(filename: string): string {
  return filename.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';
}

/** A workspace-scoped object path. The workspace prefix is what makes a finalize
 *  request unable to claim another tenant's object (see assertOwnedPath). */
export function storagePathFor(workspaceId: string, filename: string): string {
  return `${workspaceId}/${randomUUID()}-${safeName(filename)}`;
}

export function storage(): StorageProvider {
  return resolveStorageProvider({
    supabaseUrl: config.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    bucket: config.DOCUMENTS_BUCKET,
  });
}

export function storageUnconfigured(): ApiError {
  return new ApiError({
    httpStatus: API_STATUS.ServiceUnavailable,
    errorCode: 'storage_unconfigured',
    message: 'Document upload is not set up on this server yet.',
    description: 'Object storage (Supabase URL + service role key) is not configured.',
    suggestedResolution: 'Configure storage, then redeploy.',
  });
}

export function tooLarge(): ApiError {
  return new ApiError({
    httpStatus: API_STATUS.PayloadTooLarge,
    errorCode: 'file_too_large',
    message: 'That file is too large.',
    description: `The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
    suggestedResolution: 'Upload a smaller file.',
  });
}

/**
 * The plan's document cap, enforced server-side (a client cap is a suggestion).
 * Throws the KAS 403 when the workspace is already at its limit.
 */
export async function assertUnderDocumentCap(db: AppDb, ctx: StartContext): Promise<void> {
  const max = entitlementsFor(await readTier(db, ctx)).maxDocuments;
  const used = await countDocuments(db, ctx);
  if (!withinLimit(used, max)) {
    throw new ApiError({
      httpStatus: API_STATUS.Forbidden,
      errorCode: 'document_limit_reached',
      message: 'You’ve reached your plan’s document limit.',
      // No "upgrade" prompt while billing is off — see the same note on the Ask
      // limit. Restore both with the paywall.
      description: `Your plan allows ${max} documents. Remove one to make room.`,
      suggestedResolution: 'Delete a document you no longer need, then try again.',
    });
  }
}

/**
 * A finalize request supplies the object path the browser uploaded to. Reject any
 * path not under this workspace's prefix — otherwise a caller could point the row
 * at another tenant's object.
 */
export function assertOwnedPath(ctx: StartContext, path: string): void {
  if (!path.startsWith(`${ctx.workspaceId}/`)) {
    throw new ApiError({
      httpStatus: API_STATUS.Forbidden,
      errorCode: 'path_not_owned',
      message: 'That upload does not belong to this workspace.',
      description: 'The storage path is outside your workspace.',
      suggestedResolution: 'Start the upload again.',
    });
  }
}
