import { NextResponse } from 'next/server';
import { z } from 'zod';
import { config } from '@server/config';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { resolveAiProvider } from '@server/ai/provider';
import { DRAFT_TYPES, createDraft } from '@server/drafts/service';
import { generateDraft } from '@server/drafts/generate';
import { readPreferences } from '@server/users/preferences';
import { resolveStartContext } from '@server/tenant';

const generateBody = z.object({
  type: z.enum(DRAFT_TYPES),
  idea: z.string().trim().min(1, 'Give Kloyya an idea to draft from.').max(2000),
});

// A first draft from a cold model can take a few seconds; give it room.
export const maxDuration = 60;

export const POST = kasRoute('verified', async (req, ctx) => {
  const { type, idea } = generateBody.parse(await req.json());

  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const preferences = await readPreferences(ctx.db, start);
  if (!preferences?.aiDraftingEnabled) {
    throw new ApiError({
      httpStatus: API_STATUS.Forbidden,
      errorCode: 'ai_drafting_disabled',
      message: 'AI-assisted drafting is turned off.',
      description: 'Turn it on in Settings to have Kloyya draft from an idea.',
      suggestedResolution: 'Enable "AI-assisted drafting" in Settings, then try again.',
    });
  }

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
  });

  const outcome = await generateDraft(type, idea, provider);
  if (!outcome.ok) {
    if (outcome.reason === 'not_configured') {
      throw new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'ai_unconfigured',
        message: 'AI-assisted drafting is not set up on this server yet.',
        description: `No API key is configured for the "${config.AI_PROVIDER}" provider.`,
        suggestedResolution: 'Set the provider’s API key, then redeploy.',
      });
    }
    throw new ApiError({
      httpStatus: API_STATUS.ServiceUnavailable,
      errorCode: 'ai_unavailable',
      message: 'Kloyya could not reach the AI model just now.',
      description: 'The connection is fine; the model host is rate-limiting or briefly down.',
      suggestedResolution: 'Try again in a moment — nothing needs fixing.',
    });
  }

  const draft = await createDraft(ctx.db, start, {
    type,
    title: outcome.draft.title,
    body: outcome.draft.body,
  });
  return NextResponse.json(ok(draft, ctx.correlationId));
});
