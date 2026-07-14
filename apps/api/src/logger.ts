import { pino, type LoggerOptions } from 'pino';
import { config, isProduction } from './config.js';

/**
 * Structured logging (Phase 2 "logging", Phase 26 observability).
 *
 * JSON in production so logs are machine-parseable by whatever aggregator we
 * run; pretty-printed in development for human eyes. Redaction is defined here,
 * once, so a secret cannot leak through a log line — the same discipline as the
 * frontend keeping secrets out of the client projection by type.
 */
export const loggerOptions: LoggerOptions = {
  level: config.LOG_LEVEL,
  // Never log these, wherever they appear in a logged object.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.accessToken',
      '*.refreshToken',
      '*.password',
      '*.passwordHash',
      '*.SUPABASE_SERVICE_ROLE_KEY',
      '*.TOKEN_ENCRYPTION_KEY',
    ],
    censor: '[redacted]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }),
};

/**
 * A standalone instance for logging outside a request (server bootstrap and
 * shutdown). Inside a request, use `request.log` — it carries the correlation
 * id. Fastify builds its own request logger from `loggerOptions`, so the two
 * share one configuration.
 */
export const logger = pino(loggerOptions);
