import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Two test projects, one command.
 *
 *   ui     — the original jsdom suite: components, hooks, mock services.
 *   server — node-environment tests for the backend that now lives inside this
 *            app (server/** engine + app/api/** route handlers), running against
 *            an in-memory PGLite Postgres with the real migrations.
 *
 * The `server-only` package throws when imported outside a React Server
 * Components graph; the node project aliases it to an empty stub so server
 * modules stay importable under vitest.
 */
const serverOnlyStub = fileURLToPath(
  new URL('./server/test/server-only-stub.ts', import.meta.url),
);

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./test/setup.ts'],
          css: true,
          include: ['**/*.test.{ts,tsx}'],
          exclude: ['node_modules/**', '.next/**', 'server/**', 'app/api/**'],
          restoreMocks: true,
        },
      },
      {
        plugins: [tsconfigPaths()],
        resolve: { alias: { 'server-only': serverOnlyStub } },
        test: {
          name: 'server',
          environment: 'node',
          globals: true,
          setupFiles: ['./server/test/setup.ts'],
          include: ['server/**/*.test.ts', 'app/api/**/*.test.ts'],
          exclude: ['node_modules/**', '.next/**'],
          restoreMocks: true,
          // PGLite boots + migrates per suite; generous but bounded.
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
