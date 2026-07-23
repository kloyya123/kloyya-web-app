import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { resolveStartContext } from '@server/tenant';
import {
  MAX_UPLOAD_BYTES,
  assertUnderDocumentCap,
  storage,
  storagePathFor,
  storageUnconfigured,
  tooLarge,
} from '@server/documents/upload';

/**
 * Step 1 of a large upload: mint a one-time signed URL so the browser can PUT the
 * bytes straight to Supabase Storage, bypassing Vercel's ~4.5MB function body
 * limit. The plan cap and the declared size are enforced HERE, before any bytes
 * move; the finalize step (POST /v1/documents with JSON) re-checks the real size.
 */
const body = z.object({
  filename: z.string().trim().min(1).max(300),
  size: z.number().int().nonnegative(),
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const { filename, size } = body.parse(await req.json());

  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const store = storage();
  if (!store.configured) throw storageUnconfigured();
  if (size > MAX_UPLOAD_BYTES) throw tooLarge();
  await assertUnderDocumentCap(ctx.db, start);

  const path = storagePathFor(start.workspaceId, filename);
  const signed = await store.createSignedUpload(path);

  return NextResponse.json(ok(signed, ctx.correlationId));
});
