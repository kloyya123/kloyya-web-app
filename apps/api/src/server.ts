import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * The process entry point: build the app and listen. Separated from `app.ts` so
 * the app can be tested without binding a port.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info(`Kloyya API listening on http://localhost:${config.API_PORT}`);
}

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start the API');
  process.exit(1);
});
