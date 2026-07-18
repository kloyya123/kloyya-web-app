import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb } from '../auth/permission.js';
import { config } from '../config.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import { resolveAiProvider } from '../ai/provider.js';
import { ask } from '../ask/service.js';
import { resolveStartContext } from '../integrations/connect.js';

/**
 * Ask Kloyya.
 *
 * A signed-in, verified user asks a question; Kloyya answers from their own
 * connected tools and returns the sources it used. Reading is enough — this
 * doesn't change anything — so it sits behind the session guard, not a
 * permission. The two failure modes are both "the model, not you": no key
 * configured, or the model host unreachable; each is a 503 with a reason a
 * person can read, never a 500.
 */
const askBody = z.object({
  question: z.string().trim().min(1, 'Ask a question.').max(1000, 'That question is too long.'),
});

export async function askRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/ask',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { question } = askBody.parse(request.body);

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      const provider = resolveAiProvider({
        provider: config.AI_PROVIDER,
        openaiApiKey: config.OPENAI_API_KEY,
        openaiModel: config.OPENAI_MODEL,
        anthropicApiKey: config.ANTHROPIC_API_KEY,
        anthropicModel: config.ANTHROPIC_MODEL,
      });

      const outcome = await ask(db, start, question, provider);

      if (!outcome.ok) {
        if (outcome.reason === 'not_configured') {
          throw new ApiError({
            httpStatus: API_STATUS.ServiceUnavailable,
            errorCode: 'ai_unconfigured',
            message: 'Ask Kloyya is not set up on this server yet.',
            description: `No API key is configured for the "${config.AI_PROVIDER}" provider.`,
            suggestedResolution: 'Set the provider’s API key, then restart the API.',
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

      return ok(outcome.result, request.correlationId);
    },
  );
}
