import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { INTEGRATION_CATEGORIES } from '@kloyya/core';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb, requirePermission } from '../auth/permission.js';
import { config } from '../config.js';
import { createTokenCrypto } from '../crypto/tokens.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import {
  disconnectConnection,
  getConnection,
  getSummary,
  listConnections,
  pauseConnection,
  resumeConnection,
  type LifecycleResult,
} from '../integrations/service.js';
import {
  failConnection,
  markConnecting,
  resolveStartContext,
  storeGoogleTokens,
} from '../integrations/connect.js';
import { buildGoogleAuthUrl, exchangeGoogleCode, GOOGLE_SCOPES, isGoogleIntegration } from '../integrations/google.js';
import { syncGmail, syncGoogleCalendar, syncGoogleDrive, type SyncOutcome } from '../integrations/sync.js';
import { decodeState, encodeState } from '../integrations/state.js';

/**
 * The Connection Manager, matching the frontend's IntegrationsService.
 *
 * Reading is `workspace:read` (every role in a workspace can see which tools it
 * runs on); changing a connection is `integration:connect`, and disconnecting —
 * which destroys tokens — is `integration:disconnect`.
 *
 * connect / reconnect / forceSync are deliberately absent. connect and reconnect
 * are the OAuth handshake, which needs Google credentials; forceSync needs the
 * sync engine. A forceSync that only touched lastSyncedAt would tell a user
 * their data is fresh when nothing moved, which is worse than a missing button.
 */
const idParams = z.object({ id: z.string().min(1) });
const listQuery = z.object({ category: z.enum(INTEGRATION_CATEGORIES).optional() });

/**
 * A failed sync, explained.
 *
 * Each reason gets the status its cause deserves: a revoked grant needs a human
 * (409, reconnect), Google being down is temporary (503, retry), and neither is
 * a 500 — nothing went wrong on our end.
 */
function syncFailureToApiError(outcome: SyncOutcome, id: string): ApiError {
  switch (outcome.reason) {
    case 'revoked':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'connection_revoked',
        message: 'Google no longer accepts this connection.',
        description: 'It was revoked, or the Google account password changed.',
        suggestedResolution: 'Reconnect the integration to resume syncing.',
      });
    case 'refresh_failed':
    case 'transient':
      return new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'provider_unavailable',
        message: 'Google is not responding right now.',
        description: 'The connection is fine; the provider is rate-limiting or briefly unavailable.',
        suggestedResolution: 'Try again in a few minutes — nothing needs fixing.',
      });
    case 'not_connected':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'wrong_connection_state',
        message: 'That integration is not connected.',
        description: `${id} has no connection to sync.`,
        suggestedResolution: 'Connect it first.',
      });
    default:
      return new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'sync_failed',
        message: 'Kloyya could not read from Google.',
        description: 'The sync did not complete.',
        suggestedResolution: 'Try again; reconnect if it keeps failing.',
      });
  }
}

function toApiError(result: Extract<LifecycleResult, { ok: false }>, id: string): ApiError {
  switch (result.reason) {
    case 'unknown_integration':
      return errors.notFound('Integration');
    case 'no_profile':
      return errors.notFound('User profile');
    case 'wrong_state':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'wrong_connection_state',
        message: 'That integration is not in a state where this makes sense.',
        description: `${id} is currently "${result.current ?? 'unknown'}".`,
        suggestedResolution: 'Refresh the page to see its real state, then try again.',
      });
  }
}

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/integrations',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('workspace:read')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { category } = listQuery.parse(request.query);
      const list = await listConnections(requireDb(request), ctx.user.id, category);
      if (!list) throw errors.notFound('User profile');

      return ok(list, request.correlationId);
    },
  );

  app.get(
    '/v1/integrations/summary',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('workspace:read')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const summary = await getSummary(requireDb(request), ctx.user.id);
      if (!summary) throw errors.notFound('User profile');

      return ok(summary, request.correlationId);
    },
  );

  app.get(
    '/v1/integrations/:id',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('workspace:read')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const connection = await getConnection(requireDb(request), ctx.user.id, id);
      if (!connection) throw errors.notFound('Integration');

      return ok(connection, request.correlationId);
    },
  );

  app.post(
    '/v1/integrations/:id/pause',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('integration:connect')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const result = await pauseConnection(requireDb(request), ctx.user.id, id);
      if (!result.ok) throw toApiError(result, id);

      return ok(result.connection, request.correlationId);
    },
  );

  app.post(
    '/v1/integrations/:id/resume',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('integration:connect')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const result = await resumeConnection(requireDb(request), ctx.user.id, id);
      if (!result.ok) throw toApiError(result, id);

      return ok(result.connection, request.correlationId);
    },
  );

  /**
   * Begin connecting. Returns the URL to send the user to — we don't redirect,
   * because the caller is the SPA and it decides when to leave the page.
   */
  app.post(
    '/v1/integrations/:id/connect',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('integration:connect')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const scopes = GOOGLE_SCOPES[id];
      if (!isGoogleIntegration(id) || !scopes) {
        throw new ApiError({
          httpStatus: API_STATUS.NotFound,
          errorCode: 'connector_unavailable',
          message: 'That integration cannot be connected yet.',
          description: `Kloyya has a card for "${id}" but no connector for it — only Google Calendar, Gmail and Drive are wired up so far.`,
          suggestedResolution: 'Connect a Google app, or check back as more connectors land.',
        });
      }

      if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) {
        // Better an honest 503 than an authorization URL that dead-ends on
        // Google's error page.
        throw new ApiError({
          httpStatus: API_STATUS.ServiceUnavailable,
          errorCode: 'google_oauth_unconfigured',
          message: 'Google connections are not configured on this server.',
          description: 'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not set.',
          suggestedResolution: 'Set both, then restart the API.',
        });
      }
      if (!config.BETTER_AUTH_SECRET) throw errors.unauthorized();

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      await markConnecting(db, start, id);

      const authUrl = buildGoogleAuthUrl({
        clientId: config.GOOGLE_OAUTH_CLIENT_ID,
        redirectUri: config.GOOGLE_OAUTH_REDIRECT_URI,
        scopes,
        state: encodeState(
          {
            userId: start.userId,
            workspaceId: start.workspaceId,
            organizationId: start.organizationId,
            integrationId: id,
          },
          config.BETTER_AUTH_SECRET,
        ),
      });

      return ok({ authorizationUrl: authUrl }, request.correlationId);
    },
  );

  /**
   * Google's redirect back.
   *
   * Deliberately NOT session-guarded: Google sends the browser here, and the
   * cookie may not survive the cross-site redirect. The signed `state` is the
   * authorization — it proves we started this flow, for this user, recently.
   * Everything the callback trusts comes out of that signature, never out of the
   * query string.
   */
  app.get('/v1/integrations/google/callback', async (request, reply) => {
    const query = z
      .object({
        code: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        error: z.string().optional(),
      })
      .parse(request.query);

    const back = (status: string, detail?: string): string => {
      const url = new URL('/connections', config.WEB_APP_URL);
      url.searchParams.set('status', status);
      if (detail) url.searchParams.set('integration', detail);
      return url.toString();
    };

    if (!query.state) return reply.redirect(back('invalid'));
    if (!config.BETTER_AUTH_SECRET) return reply.redirect(back('unconfigured'));

    const decoded = decodeState(query.state, config.BETTER_AUTH_SECRET);
    // A forged or stale state is where an attacker would graft their Google
    // account onto someone else's workspace. Nothing is written on this path.
    if (!decoded.ok) return reply.redirect(back(decoded.reason === 'expired' ? 'expired' : 'invalid'));

    const state = decoded.state;
    const db = request.server.db;
    if (!db) return reply.redirect(back('unconfigured'));

    const start = {
      userId: state.userId,
      workspaceId: state.workspaceId,
      organizationId: state.organizationId,
    };

    // The user declined on Google's consent screen. Not an error to shout about.
    if (query.error || !query.code) {
      await failConnection(db, start, state.integrationId, 'The connection was cancelled before it finished.');
      return reply.redirect(back('cancelled', state.integrationId));
    }

    if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) {
      return reply.redirect(back('unconfigured', state.integrationId));
    }
    if (!config.TOKEN_ENCRYPTION_KEY) {
      // Refusing beats storing a customer's Google token in the clear.
      await failConnection(db, start, state.integrationId, 'This server cannot store connections securely.');
      return reply.redirect(back('unconfigured', state.integrationId));
    }

    try {
      const tokens = await exchangeGoogleCode({
        code: query.code,
        clientId: config.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: config.GOOGLE_OAUTH_CLIENT_SECRET,
        redirectUri: config.GOOGLE_OAUTH_REDIRECT_URI,
      });

      const stored = await storeGoogleTokens(
        db,
        createTokenCrypto(config.TOKEN_ENCRYPTION_KEY),
        start,
        state.integrationId,
        tokens,
      );

      if (!stored.ok) return reply.redirect(back(stored.reason, state.integrationId));
      return reply.redirect(back('connected', state.integrationId));
    } catch (error) {
      request.log.error({ err: error, correlationId: request.correlationId }, 'Google token exchange failed');
      await failConnection(db, start, state.integrationId, 'Google refused the connection. Try again.');
      return reply.redirect(back('failed', state.integrationId));
    }
  });

  /**
   * Sync now.
   *
   * Real work, not a timestamp: it reads Google and lands what changed. It runs
   * inline because a calendar is small and the user is watching; mail and drive
   * will need the durable worker, and this is where that boundary will show.
   */
  app.post(
    '/v1/integrations/:id/sync',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('integration:connect')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      // The providers with a working sync. As more land, they join this map — the
      // route stays one shape rather than growing an if-ladder.
      const SYNCERS: Record<string, typeof syncGoogleCalendar> = {
        google_calendar: syncGoogleCalendar,
        gmail: syncGmail,
        google_drive: syncGoogleDrive,
      };
      const syncer = SYNCERS[id];
      if (!syncer) {
        throw new ApiError({
          httpStatus: API_STATUS.NotFound,
          errorCode: 'connector_unavailable',
          message: 'That integration cannot sync yet.',
          description: `Kloyya has no sync for "${id}" — only Google Calendar, Gmail and Google Drive are wired up so far.`,
          suggestedResolution: 'Check back as more connectors land.',
        });
      }

      if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) {
        throw new ApiError({
          httpStatus: API_STATUS.ServiceUnavailable,
          errorCode: 'google_oauth_unconfigured',
          message: 'Google connections are not configured on this server.',
          description: 'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not set.',
          suggestedResolution: 'Set both, then restart the API.',
        });
      }
      if (!config.TOKEN_ENCRYPTION_KEY) {
        throw new ApiError({
          httpStatus: API_STATUS.ServiceUnavailable,
          errorCode: 'encryption_unconfigured',
          message: 'This server cannot read stored connections securely.',
          description: 'TOKEN_ENCRYPTION_KEY is not set.',
          suggestedResolution: 'Set it, then restart the API.',
        });
      }

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      const outcome = await syncer(db, createTokenCrypto(config.TOKEN_ENCRYPTION_KEY), start, {
        clientId: config.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: config.GOOGLE_OAUTH_CLIENT_SECRET,
      });

      if (!outcome.ok) throw syncFailureToApiError(outcome, id);

      const connection = await getConnection(db, ctx.user.id, id);
      if (!connection) throw errors.notFound('Integration');

      return ok(
        {
          connection,
          synced: { fetched: outcome.fetched, written: outcome.written, removed: outcome.tombstoned },
        },
        request.correlationId,
      );
    },
  );

  app.post(
    '/v1/integrations/:id/disconnect',
    {
      preHandler: [
        requireSession,
        requireVerifiedEmail,
        requirePermission('integration:disconnect'),
      ],
    },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const result = await disconnectConnection(requireDb(request), ctx.user.id, id);
      if (!result.ok) throw toApiError(result, id);

      return ok(result.connection, request.correlationId);
    },
  );
}
