import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveAiProvider } from '@server/ai/provider';
import { config } from '@server/config';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { getArticle } from '@server/knowledge/service';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().uuid('That is not an article id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

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

  const article = await getArticle(ctx.db, start, provider, id);
  return NextResponse.json(ok(article, ctx.correlationId));
});
