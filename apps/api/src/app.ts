import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { fastify, type FastifyInstance } from 'fastify';
import type { AppDb } from '@kloyya/db';
import { config } from './config.js';
import { type Auth, buildAuthFromEnv, resolveDbFromEnv } from './auth/auth.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerErrorHandler } from './http/errors.js';
import { newCorrelationId } from './http/envelope.js';
import { loggerOptions } from './logger.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { settingsRoutes } from './routes/settings.js';

export interface BuildAppOptions {
  /**
   * The database. Omit to resolve from env (the server's path); pass an explicit
   * one to inject a test-backed (PGLite) client.
   */
  db?: AppDb | null;
  /**
   * The auth instance to mount. Omit to build from the resolved db + env secret;
   * pass an explicit instance to inject a test-backed one; pass `null` to build
   * the app with auth deliberately disabled.
   */
  auth?: Auth | null;
}

/**
 * Assemble the API. Kept separate from `server.ts` (which listens) so tests can
 * build the app and inject requests without opening a socket.
 *
 * The route handlers stay thin by design — validate, call a service, serialize
 * the envelope — exactly like the frontend's pages stayed thin over its service
 * layer. All real logic lives in service classes with no framework imports, so
 * the durable worker can share them without dragging Fastify along.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
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

  // Auth mounts only when configured. `undefined` means "resolve from env";
  // an explicit value (including null) is honored as-is, which is how tests
  // inject a PGLite-backed instance.
  const db = options.db !== undefined ? options.db : await resolveDbFromEnv();
  const auth =
    options.auth !== undefined ? options.auth : db ? buildAuthFromEnv(db) : null;

  // Handlers reach these via request.server.{db,auth}.
  app.decorate('db', db);
  app.decorate('auth', auth);
  if (auth) {
    registerAuthRoutes(app, auth);
    await app.register(meRoutes);
    await app.register(onboardingRoutes);
    await app.register(settingsRoutes);
    app.log.info('Better Auth mounted at /api/auth/*');
  } else {
    app.log.warn('Auth not mounted — set DATABASE_URL and BETTER_AUTH_SECRET to enable it.');
  }

  return app;
}
