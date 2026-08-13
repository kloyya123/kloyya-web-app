import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveAiProvider } from '@server/ai/provider';
import { config } from '@server/config';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { listArticles } from '@server/knowledge/service';
import { resolveStartContext } from '@server/tenant';

// Summary generation is a real model call per unsummarized document (see
// ensureSummaries in server/knowledge/service.ts) — this bounds it to the
// route's own budget, matching ask/drafts/documents/cron below.
export const maxDuration = 60;

const listQuery = z.object({
  category: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
});

export const GET = kasRoute('verified', async (req, ctx) => {
  const parsed = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const filter = {
    ...(parsed.category ? { category: parsed.category } : {}),
    ...(parsed.tag ? { tag: parsed.tag } : {}),
  };
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

  const list = await listArticles(ctx.db, start, provider, filter);
  return NextResponse.json(ok(list, ctx.correlationId));
});
