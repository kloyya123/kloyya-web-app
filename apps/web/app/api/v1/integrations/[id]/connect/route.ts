import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { markConnecting } from '@server/integrations/connect';
import { resolveStartContext } from '@server/tenant';
import { buildGoogleAuthUrl, GOOGLE_SCOPES, isGoogleIntegration } from '@server/integrations/google';
import {
  buildMicrosoftAuthUrl,
  isMicrosoftIntegration,
  MICROSOFT_SCOPES,
} from '@server/integrations/microsoft';
import { buildNotionAuthUrl, isNotionIntegration } from '@server/integrations/notion';
import { encodeState } from '@server/integrations/state';

const idParam = z.string().min(1);

function oauthUnconfigured(provider: string, vars: string): ApiError {
  return new ApiError({
    httpStatus: API_STATUS.ServiceUnavailable,
    errorCode: `${provider.toLowerCase()}_oauth_unconfigured`,
    message: `${provider} connections are not configured on this server.`,
    description: `${vars} are not set.`,
    suggestedResolution: 'Set them, then redeploy.',
  });
}

/**
 * Begin connecting. Returns the URL to send the user to — the client (the SPA)
 * decides when to leave the page, so this returns the URL rather than
 * redirecting. The signed `state` (HMAC over the tenant coordinates, keyed by
 * TOKEN_ENCRYPTION_KEY) is what the callback later trusts.
 */
export const POST = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'integration:connect');
  const id = idParam.parse(ctx.params['id']);

  const provider = isGoogleIntegration(id)
    ? 'google'
    : isMicrosoftIntegration(id)
      ? 'microsoft'
      : isNotionIntegration(id)
        ? 'notion'
        : null;

  if (!provider) {
    throw new ApiError({
      httpStatus: API_STATUS.NotFound,
      errorCode: 'connector_unavailable',
      message: 'That integration cannot be connected yet.',
      description: `Kloyya has a card for "${id}" but no connector for it yet.`,
      suggestedResolution: 'Connect a Google, Microsoft or Notion app, or check back as more land.',
    });
  }
  if (!config.TOKEN_ENCRYPTION_KEY) throw errors.unauthorized();

  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const state = encodeState(
    {
      userId: start.userId,
      workspaceId: start.workspaceId,
      organizationId: start.organizationId,
      integrationId: id,
    },
    config.TOKEN_ENCRYPTION_KEY,
  );

  let authUrl: string;
  if (provider === 'google') {
    if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) {
      throw oauthUnconfigured('Google', 'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
    }
    await markConnecting(ctx.db, start, id);
    authUrl = buildGoogleAuthUrl({
      clientId: config.GOOGLE_OAUTH_CLIENT_ID,
      redirectUri: config.GOOGLE_OAUTH_REDIRECT_URI,
      scopes: GOOGLE_SCOPES[id]!,
      state,
    });
  } else if (provider === 'microsoft') {
    if (!config.MICROSOFT_OAUTH_CLIENT_ID || !config.MICROSOFT_OAUTH_CLIENT_SECRET) {
      throw oauthUnconfigured(
        'Microsoft',
        'MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET',
      );
    }
    await markConnecting(ctx.db, start, id);
    authUrl = buildMicrosoftAuthUrl({
      clientId: config.MICROSOFT_OAUTH_CLIENT_ID,
      redirectUri: config.MICROSOFT_OAUTH_REDIRECT_URI,
      scopes: MICROSOFT_SCOPES[id]!,
      state,
    });
  } else {
    if (!config.NOTION_OAUTH_CLIENT_ID || !config.NOTION_OAUTH_CLIENT_SECRET) {
      throw oauthUnconfigured('Notion', 'NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET');
    }
    await markConnecting(ctx.db, start, id);
    // Notion has no scopes — access is granted per-page in Notion's own UI.
    authUrl = buildNotionAuthUrl({
      clientId: config.NOTION_OAUTH_CLIENT_ID,
      redirectUri: config.NOTION_OAUTH_REDIRECT_URI,
      state,
    });
  }

  return NextResponse.json(ok({ authorizationUrl: authUrl }, ctx.correlationId));
});
