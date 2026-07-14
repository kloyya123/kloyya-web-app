import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Threads this request through logs, DB calls, external APIs, and the audit log. */
    correlationId: string;
  }
}
