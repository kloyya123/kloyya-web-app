import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { createTokenCrypto } from '@server/crypto/tokens';
import { getConnection } from '@server/integrations/service';
import { isNotionIntegration } from '@server/integrations/notion';
import { resolveStartContext } from '@server/tenant';
import { syncGmail, syncGoogleCalendar, syncGoogleDrive, syncNotion } from '@server/integrations/sync';
import { syncFailureToApiError } from '@server/integrations/route-helpers';

const idParam = z.string().min(1);

// A first Gmail/Drive sync pulls many pages; give it room. Pro plans allow more.
export const maxDuration = 60;

const SYNCERS: Record<string, typeof syncGoogleCalendar> = {
  google_calendar: syncGoogleCalendar,
  gmail: syncGmail,
  google_drive: syncGoogleDrive,
  notion: syncNotion,
};

/** Sync now — real work, not a timestamp. It reads the provider and lands changes. */
export const POST = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'integration:connect');
  const id = idParam.parse(ctx.params['id']);

  const syncer = SYNCERS[id];
  if (!syncer) {
    throw new ApiError({
      httpStatus: API_STATUS.NotFound,
      errorCode: 'connector_unavailable',
      message: 'That integration cannot sync yet.',
      description: `Kloyya has no sync for "${id}".`,
      suggestedResolution: 'Check back as more connectors land.',
    });
  }

  // Each provider syncs on its own credentials. Notion is the exception — its
  // token never expires, so it needs no client credentials, only the key to
  // decrypt the stored token.
  const usesNotion = isNotionIntegration(id);
  const clientId = (usesNotion ? '' : config.GOOGLE_OAUTH_CLIENT_ID) ?? '';
  const clientSecret = (usesNotion ? '' : config.GOOGLE_OAUTH_CLIENT_SECRET) ?? '';

  if (!usesNotion && (!clientId || !clientSecret)) {
    throw new ApiError({
      httpStatus: API_STATUS.ServiceUnavailable,
      errorCode: 'google_oauth_unconfigured',
      message: 'Google connections are not configured on this server.',
      description: 'GOOGLE_OAUTH_CLIENT_ID and _SECRET are not set.',
      suggestedResolution: 'Set both, then redeploy.',
    });
  }
  if (!config.TOKEN_ENCRYPTION_KEY) {
    throw new ApiError({
      httpStatus: API_STATUS.ServiceUnavailable,
      errorCode: 'encryption_unconfigured',
      message: 'This server cannot read stored connections securely.',
      description: 'TOKEN_ENCRYPTION_KEY is not set.',
      suggestedResolution: 'Set it, then redeploy.',
    });
  }

  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const outcome = await syncer(ctx.db, createTokenCrypto(config.TOKEN_ENCRYPTION_KEY), start, {
    clientId,
    clientSecret,
  });
  if (!outcome.ok) throw syncFailureToApiError(outcome, id);

  const connection = await getConnection(ctx.db, ctx.identity.id, id);
  if (!connection) throw errors.notFound('Integration');

  return NextResponse.json(
    ok(
      {
        connection,
        synced: { fetched: outcome.fetched, written: outcome.written, removed: outcome.tombstoned },
      },
      ctx.correlationId,
    ),
  );
});
