import 'fastify';
import type { Auth } from '../auth/auth.js';
import type { SessionContext } from '../auth/guard.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** The auth backend, or null when it isn't configured on this instance. */
    auth: Auth | null;
  }

  interface FastifyRequest {
    /** Threads this request through logs, DB calls, external APIs, and the audit log. */
    correlationId: string;
    /** Set by the `requireSession` guard on authenticated routes. */
    auth?: SessionContext;
  }
}
