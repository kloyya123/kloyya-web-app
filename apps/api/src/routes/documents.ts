import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { entitlementsFor, remaining, withinLimit } from '@kloyya/core';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb } from '../auth/permission.js';
import { config } from '../config.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import { extractText } from '../documents/extract.js';
import {
  countDocuments,
  createDocument,
  deleteDocument,
  listDocuments,
} from '../documents/service.js';
import { readTier } from '../plan/tier.js';
import { resolveStorageProvider, StorageUnconfiguredError } from '../storage/provider.js';
import { resolveStartContext } from '../integrations/connect.js';

/**
 * Documents.
 *
 * Upload a file, keep it, search it. The bytes go to object storage; the row and
 * its extracted text stay in Postgres so Ask Kloyya and search can read them. The
 * Free plan caps how many a workspace may keep — enforced here, not only in the
 * UI, because a client-side cap is a suggestion. Delete is a soft delete plus a
 * best-effort removal of the stored bytes.
 */
const idParams = z.object({ id: z.string().uuid() });

/** Keep a storage path predictable and safe from a hostile filename. */
function safeName(filename: string): string {
  return filename.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';
}

function storage() {
  return resolveStorageProvider({
    supabaseUrl: config.SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    bucket: config.DOCUMENTS_BUCKET,
  });
}

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/documents',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      const items = await listDocuments(db, start);
      const max = entitlementsFor(await readTier(db, start)).maxDocuments;
      return ok(
        { items, usage: { used: items.length, limit: max, remaining: remaining(items.length, max) } },
        request.correlationId,
      );
    },
  );

  app.post(
    '/v1/documents',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      const store = storage();
      if (!store.configured) {
        throw new ApiError({
          httpStatus: API_STATUS.ServiceUnavailable,
          errorCode: 'storage_unconfigured',
          message: 'Document upload is not set up on this server yet.',
          description: 'Object storage (SUPABASE_URL + service role key) is not configured.',
          suggestedResolution: 'Configure storage, then restart the API.',
        });
      }

      // Entitlement gate: the Free plan caps how many documents a workspace keeps.
      const max = entitlementsFor(await readTier(db, start)).maxDocuments;
      const used = await countDocuments(db, start);
      if (!withinLimit(used, max)) {
        throw new ApiError({
          httpStatus: API_STATUS.Forbidden,
          errorCode: 'document_limit_reached',
          message: 'You’ve reached your plan’s document limit.',
          description: `Your plan allows ${max} documents. Remove one, or upgrade for unlimited.`,
          suggestedResolution: 'Delete a document, or upgrade to Pro.',
        });
      }

      const file = await request.file();
      if (!file) {
        throw new ApiError({
          httpStatus: API_STATUS.BadRequest,
          errorCode: 'no_file',
          message: 'No file was uploaded.',
          description: 'The request carried no multipart file part.',
          suggestedResolution: 'Attach a file and try again.',
        });
      }

      const bytes = await file.toBuffer();
      const storagePath = `${start.workspaceId}/${randomUUID()}-${safeName(file.filename)}`;

      try {
        await store.upload({ path: storagePath, bytes, contentType: file.mimetype });
      } catch (error) {
        if (error instanceof StorageUnconfiguredError) {
          throw new ApiError({
            httpStatus: API_STATUS.ServiceUnavailable,
            errorCode: 'storage_unconfigured',
            message: 'Document upload is not set up on this server yet.',
            description: 'Object storage is not configured.',
            suggestedResolution: 'Configure storage, then restart the API.',
          });
        }
        throw new ApiError({
          httpStatus: API_STATUS.ServiceUnavailable,
          errorCode: 'storage_failed',
          message: 'Kloyya could not store that file just now.',
          description: 'The storage backend rejected the upload.',
          suggestedResolution: 'Try again in a moment.',
        });
      }

      const extractedText = await extractText(bytes, file.mimetype, file.filename);
      const doc = await createDocument(db, start, {
        name: file.filename,
        mimeType: file.mimetype,
        sizeBytes: bytes.length,
        storagePath,
        extractedText,
        uploadedByUserId: start.userId,
      });

      return ok(doc, request.correlationId);
    },
  );

  app.delete(
    '/v1/documents/:id',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      const removed = await deleteDocument(db, start, id);
      if (!removed) throw errors.notFound('Document');

      // The row is soft-deleted regardless; removing the bytes is best-effort —
      // an orphaned object is a cleanup job, not a failed request.
      try {
        await storage().remove(removed.storagePath);
      } catch {
        request.log.warn({ storagePath: removed.storagePath }, 'document bytes not removed');
      }

      return ok({ id }, request.correlationId);
    },
  );
}
