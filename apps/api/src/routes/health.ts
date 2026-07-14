import type { FastifyInstance } from 'fastify';
import { ok } from '../http/envelope.js';
import { config } from '../config.js';

const startedAt = Date.now();

/**
 * Health checks (Phase 2 "health check", Phase 29 monitoring).
 *
 * `/health` is a liveness probe — is the process up. `/v1/health` is the
 * versioned, envelope-wrapped variant a monitor or the frontend can call.
 * A `/health/ready` readiness probe (can we reach the DB and Redis) lands in
 * Phase 3 once those exist; wiring it before there is a database to check would
 * be a health check that lies.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));

  app.get('/v1/health', async (request) =>
    ok(
      {
        status: 'ok',
        environment: config.NODE_ENV,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      },
      request.correlationId,
    ),
  );
}
