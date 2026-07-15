import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from './auth.js';

/**
 * Mount Better Auth under /api/auth/*.
 *
 * Better Auth speaks the web Fetch API (Request → Response). Rather than fight
 * Fastify's body parser for the raw stream, we let Fastify parse as usual and
 * rebuild a web Request from the parsed pieces, then hand it to `auth.handler`.
 *
 * The one subtlety is Set-Cookie: `Headers.forEach` collapses repeated headers
 * into a single comma-joined value, which corrupts multiple cookies. We copy
 * every other header that way but pull cookies out via `getSetCookie()` and set
 * them as an array, so session + csrf cookies survive intact.
 */
export function registerAuthRoutes(app: FastifyInstance, auth: Auth): void {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const host = request.headers.host ?? 'localhost';
      const url = new URL(request.url, `${request.protocol}://${host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else if (value !== undefined) {
          headers.append(key, value);
        }
      }

      const method = request.method.toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD' && request.body !== undefined;

      const response = await auth.handler(
        new Request(url, {
          method,
          headers,
          ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
        }),
      );

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header('set-cookie', cookies);

      const text = await response.text();
      return reply.send(text.length > 0 ? text : null);
    },
  });
}
