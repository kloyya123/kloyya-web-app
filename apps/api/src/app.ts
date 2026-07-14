import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { fastify, type FastifyInstance } from 'fastify';
import { config } from './config.js';
import { registerErrorHandler } from './http/errors.js';
import { newCorrelationId } from './http/envelope.js';
import { loggerOptions } from './logger.js';
import { healthRoutes } from './routes/health.js';

/**
 * Assemble the API. Kept separate from `server.ts` (which listens) so tests can
 * build the app and inject requests without opening a socket.
 *
 * The route handlers stay thin by design — validate, call a service, serialize
 * the envelope — exactly like the frontend's pages stayed thin over its service
 * layer. All real logic lives in service classes with no framework imports, so
 * the durable worker can share them without dragging Fastify along.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: loggerOptions,
    // Trust the proxy in front of us (Vercel/Render/etc.) for the real client IP.
    trustProxy: true,
    // We generate our own correlation id and reuse it as the request id.
    genReqId: () => newCorrelationId(),
  });

  // Every request carries a correlation id from its first line of logging on.
  app.addHook('onRequest', async (request) => {
    request.correlationId = request.id;
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ALLOWED_ORIGINS,
    credentials: true,
  });
  await app.register(sensible);

  registerErrorHandler(app);

  await app.register(healthRoutes);

  return app;
}
