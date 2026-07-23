import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { deleteDocument } from '@server/documents/service';
import { resolveStorageProvider } from '@server/storage/provider';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().uuid();

export const DELETE = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const removed = await deleteDocument(ctx.db, start, id);
  if (!removed) throw errors.notFound('Document');

  // The row is soft-deleted regardless; removing the bytes is best-effort — an
  // orphaned object is a cleanup job, not a failed request.
  try {
    await resolveStorageProvider({
      supabaseUrl: config.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
      bucket: config.DOCUMENTS_BUCKET,
    }).remove(removed.storagePath);
  } catch {
    console.warn(`[documents] bytes not removed: ${removed.storagePath}`);
  }

  return NextResponse.json(ok({ id }, ctx.correlationId));
});
