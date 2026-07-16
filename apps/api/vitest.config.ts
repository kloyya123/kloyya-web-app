import { defineConfig } from 'vitest/config';

/**
 * The API's suites boot an in-process Postgres (PGLite), run the real
 * migrations, and drive Better Auth's password hashing — all comfortably slower
 * than a unit test. The default 5s/10s timeouts fail these for being slow rather
 * than wrong, which is a flake, not a signal. Budget accordingly.
 */
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
