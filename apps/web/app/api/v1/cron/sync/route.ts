import { NextResponse, type NextRequest } from 'next/server';
import { resolveAiProvider } from '@server/ai/provider';
import { config } from '@server/config';
import { createTokenCrypto } from '@server/crypto/tokens';
import { getDeps } from '@server/deps';
import { API_STATUS, ApiError, toErrorPayload } from '@server/http/errors';
import { newCorrelationId } from '@server/http/envelope';
import { runScheduledSync } from '@server/sync/scheduler';

/**
 * Keeping every workspace's data fresh, on a schedule — see server/sync/scheduler.ts.
 *
 * NOT behind `kasRoute`. That wrapper authenticates a person's session; the
 * caller here is Vercel Cron, which has none. Authentication is instead the
 * shared secret Vercel sends as a bearer token on every scheduled invocation —
 * see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 *
 * A first Gmail/Drive sync can run long (see the sync route's own comment);
 * this reserves the same ceiling Vercel's Cron product allows on a Pro plan.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<Response> {
  const correlationId = newCorrelationId();

  // Refuse to run rather than run open. An unauthenticated endpoint that syncs
  // every tenant's mail and files is a categorically worse failure than a cron
  // tick that does nothing.
  if (!config.CRON_SECRET) {
    return errorResponse(
      new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'cron_unconfigured',
        message: 'Scheduled sync is not configured on this server.',
        description: 'CRON_SECRET is not set.',
        suggestedResolution: 'Set it, then redeploy.',
      }),
      correlationId,
    );
  }

  const authorization = req.headers.get('authorization');
  if (authorization !== `Bearer ${config.CRON_SECRET}`) {
    return errorResponse(
      new ApiError({
        httpStatus: API_STATUS.Unauthorized,
        errorCode: 'unauthorized',
        message: 'This endpoint requires the cron secret.',
        description: 'The Authorization header did not match CRON_SECRET.',
        suggestedResolution: 'Only Vercel Cron should be calling this route.',
      }),
      correlationId,
    );
  }

  if (!config.TOKEN_ENCRYPTION_KEY) {
    return errorResponse(
      new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'encryption_unconfigured',
        message: 'This server cannot read stored connections securely.',
        description: 'TOKEN_ENCRYPTION_KEY is not set.',
        suggestedResolution: 'Set it, then redeploy.',
      }),
      correlationId,
    );
  }

  const deps = await getDeps();

  const provider = resolveAiProvider({
    provider: config.AI_PROVIDER,
    openaiApiKey: config.OPENAI_API_KEY,
    openaiModel: config.OPENAI_MODEL,
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    anthropicModel: config.ANTHROPIC_MODEL,
    perplexityApiKey: config.PERPLEXITY_API_KEY,
    perplexityChatModel: config.PERPLEXITY_CHAT_MODEL,
    nvidiaApiKey: config.NVIDIA_API_KEY,
    nvidiaModel: config.NVIDIA_MODEL,
    huggingfaceApiKey: config.HUGGINGFACE_API_KEY,
    huggingfaceModel: config.HUGGINGFACE_MODEL,
  });

  const summary = await runScheduledSync(deps.db, {
    crypto: createTokenCrypto(config.TOKEN_ENCRYPTION_KEY),
    googleClientId: config.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret: config.GOOGLE_OAUTH_CLIENT_SECRET,
    aiProvider: provider,
  });

  return NextResponse.json(
    { ok: true, correlationId, ...summary },
    { headers: { 'x-correlation-id': correlationId } },
  );
}

function errorResponse(error: ApiError, correlationId: string): NextResponse {
  const payload = toErrorPayload(error, correlationId);
  console.error(`[cron] ${payload.message}`, { correlationId });
  return NextResponse.json(
    { error: payload },
    { status: payload.httpStatus, headers: { 'x-correlation-id': correlationId } },
  );
}
