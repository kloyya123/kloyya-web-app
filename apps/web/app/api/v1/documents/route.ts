import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { entitlementsFor, remaining, withinLimit } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { extractText } from '@server/documents/extract';
import { countDocuments, createDocument, listDocuments } from '@server/documents/service';
import { readTier } from '@server/plan/tier';
import { resolveStorageProvider, StorageUnconfiguredError } from '@server/storage/provider';
import { resolveStartContext } from '@server/tenant';

/**
 * Documents. Upload a file, keep it, search it. Bytes go to object storage; the
 * row and extracted text stay in Postgres so Ask Kloyya and search can read
 * them. The Free plan caps how many a workspace keeps — enforced here, not only
 * in the UI, because a client-side cap is a suggestion.
 *
 * NOTE: Vercel caps request bodies at ~4.5MB. The signed-URL upload flow (added
 * later) restores the full 25MB limit for large files; this multipart path is
 * correct for local dev, tests, and small uploads.
 */
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function safeName(filename: string): string {
  return filename.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';
}

function storage() {
  return resolveStorageProvider({
    supabaseUrl: config.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    bucket: config.DOCUMENTS_BUCKET,
  });
}

export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const items = await listDocuments(ctx.db, start);
  const max = entitlementsFor(await readTier(ctx.db, start)).maxDocuments;
  return NextResponse.json(
    ok(
      { items, usage: { used: items.length, limit: max, remaining: remaining(items.length, max) } },
      ctx.correlationId,
    ),
  );
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const store = storage();
  if (!store.configured) throw storageUnconfigured();

  // Entitlement gate: the Free plan caps how many documents a workspace keeps.
  const max = entitlementsFor(await readTier(ctx.db, start)).maxDocuments;
  const used = await countDocuments(ctx.db, start);
  if (!withinLimit(used, max)) {
    throw new ApiError({
      httpStatus: API_STATUS.Forbidden,
      errorCode: 'document_limit_reached',
      message: 'You’ve reached your plan’s document limit.',
      description: `Your plan allows ${max} documents. Remove one, or upgrade for unlimited.`,
      suggestedResolution: 'Delete a document, or upgrade to Pro.',
    });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new ApiError({
      httpStatus: API_STATUS.BadRequest,
      errorCode: 'no_file',
      message: 'No file was uploaded.',
      description: 'The request carried no multipart file part named "file".',
      suggestedResolution: 'Attach a file and try again.',
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError({
      httpStatus: API_STATUS.PayloadTooLarge,
      errorCode: 'file_too_large',
      message: 'That file is too large.',
      description: `The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
      suggestedResolution: 'Upload a smaller file.',
    });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name || 'file';
  const mimeType = file.type || 'application/octet-stream';
  const storagePath = `${start.workspaceId}/${randomUUID()}-${safeName(filename)}`;

  try {
    await store.upload({ path: storagePath, bytes, contentType: mimeType });
  } catch (error) {
    if (error instanceof StorageUnconfiguredError) throw storageUnconfigured();
    throw new ApiError({
      httpStatus: API_STATUS.ServiceUnavailable,
      errorCode: 'storage_failed',
      message: 'Kloyya could not store that file just now.',
      description: 'The storage backend rejected the upload.',
      suggestedResolution: 'Try again in a moment.',
    });
  }

  const extractedText = await extractText(bytes, mimeType, filename);
  const doc = await createDocument(ctx.db, start, {
    name: filename,
    mimeType,
    sizeBytes: bytes.length,
    storagePath,
    extractedText,
    uploadedByUserId: start.userId,
  });

  return NextResponse.json(ok(doc, ctx.correlationId));
});

function storageUnconfigured(): ApiError {
  return new ApiError({
    httpStatus: API_STATUS.ServiceUnavailable,
    errorCode: 'storage_unconfigured',
    message: 'Document upload is not set up on this server yet.',
    description: 'Object storage (Supabase URL + service role key) is not configured.',
    suggestedResolution: 'Configure storage, then redeploy.',
  });
}
