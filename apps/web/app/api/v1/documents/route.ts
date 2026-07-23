import { NextResponse } from 'next/server';
import { z } from 'zod';
import { entitlementsFor, remaining } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { extractText } from '@server/documents/extract';
import { createDocument, listDocuments } from '@server/documents/service';
import { readTier } from '@server/plan/tier';
import { StorageUnconfiguredError } from '@server/storage/provider';
import { resolveStartContext, type StartContext } from '@server/tenant';
import type { AppDb } from '@kloyya/db/client';
import {
  MAX_UPLOAD_BYTES,
  assertOwnedPath,
  assertUnderDocumentCap,
  storage,
  storagePathFor,
  storageUnconfigured,
  tooLarge,
} from '@server/documents/upload';

/**
 * Documents. Upload a file, keep it, search it. Bytes go to object storage; the
 * row and extracted text stay in Postgres so Ask Kloyya and search can read them.
 *
 * POST accepts two shapes:
 *   • multipart/form-data — the browser sends the file through this function.
 *     Simple, but capped by Vercel's ~4.5MB request-body limit. Good for local
 *     dev, tests, and small files.
 *   • application/json { path, filename, mimeType, size } — the FINALIZE step of
 *     the signed-URL flow: the browser already PUT the bytes straight to storage
 *     (up to 25MB), and this reads them back, extracts text, and lands the row.
 */
export const maxDuration = 60;

const finalizeBody = z.object({
  path: z.string().min(1),
  filename: z.string().trim().min(1).max(300),
  mimeType: z.string().min(1).max(200).default('application/octet-stream'),
  size: z.number().int().nonnegative(),
});

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
  await assertUnderDocumentCap(ctx.db, start);

  const contentType = req.headers.get('content-type') ?? '';
  const doc = contentType.includes('application/json')
    ? await finalizeSignedUpload(req, ctx.db, start)
    : await handleMultipart(req, ctx.db, start);

  return NextResponse.json(ok(doc, ctx.correlationId));
});

/** The signed-URL finalize: bytes are already in storage; read, extract, land. */
async function finalizeSignedUpload(req: Request, db: AppDb, start: StartContext) {
  const { path, filename, mimeType } = finalizeBody.parse(await req.json());
  assertOwnedPath(start, path);

  const store = storage();
  let bytes: Buffer;
  try {
    bytes = await store.download(path);
  } catch (error) {
    if (error instanceof StorageUnconfiguredError) throw storageUnconfigured();
    throw new ApiError({
      httpStatus: API_STATUS.BadRequest,
      errorCode: 'upload_not_found',
      message: 'That upload could not be found in storage.',
      description: 'The bytes were not present at the finalize step — the direct upload may have failed.',
      suggestedResolution: 'Try the upload again.',
    });
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    await store.remove(path).catch(() => {});
    throw tooLarge();
  }

  const extractedText = await extractText(bytes, mimeType, filename);
  return createDocument(db, start, {
    name: filename,
    mimeType,
    sizeBytes: bytes.length,
    storagePath: path,
    extractedText,
    uploadedByUserId: start.userId,
  });
}

/** The classic multipart path — the browser streams the file through us. */
async function handleMultipart(req: Request, db: AppDb, start: StartContext) {
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
  if (file.size > MAX_UPLOAD_BYTES) throw tooLarge();

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name || 'file';
  const mimeType = file.type || 'application/octet-stream';
  const storagePath = storagePathFor(start.workspaceId, filename);

  const store = storage();
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
  return createDocument(db, start, {
    name: filename,
    mimeType,
    sizeBytes: bytes.length,
    storagePath,
    extractedText,
    uploadedByUserId: start.userId,
  });
}
