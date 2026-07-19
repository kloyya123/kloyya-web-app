import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * ESLint for the API — the backend counterpart to the web app's flat config.
 *
 * The API had a `lint` script all along but no config and no eslint installed,
 * so `pnpm lint` could never actually run here; the package leaned on `tsc` for
 * static checking. This wires the same house style the web app enforces —
 * no-unnecessary-any, type-only imports declared as such, `eqeqeq` — onto the
 * server, so a lint sweep covers the whole workspace, not half of it.
 *
 * One deliberate difference from the web config: `no-console` is OFF. The server
 * logs through Pino (`request.log` / `app.log`), and the few `console.*` calls
 * that exist are in bootstrap paths where that is the right channel — the web
 * app's "never console.log in a component" rule has no meaning here.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // An `any` must be argued for, not merged by default — error, not warn.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Types must not survive into the runtime bundle.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
    },
  },

  // Tests may reach for the occasional escape hatch the strict rules forbid.
  {
    files: ['**/*.test.ts', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier,
);
