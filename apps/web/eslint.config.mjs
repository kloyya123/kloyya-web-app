import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * KFA layering rules, enforced rather than trusted to review.
 *
 *   Presentation (components/) -> no business logic, no feature knowledge.
 *   Shared (components/, hooks/, lib/, utils/) -> never reaches into features/.
 *   UI components -> never call services directly. Only hooks and features do.
 *   Nothing above the data layer -> ever imports mock/.
 */

/**
 * The Engineering Quality Gate: "Only the data layer should change when moving
 * from mock data to production APIs."
 *
 * That promise is only real if the mock is unreachable from the UI. A component
 * importing `@/mock` — even for something as innocent as a category label or the
 * demo clock — means `mock/` cannot be deleted the day the backend lands. Only
 * services/ (the swap point) and mock/ itself may reach it.
 */
const noMockImports = {
  group: ['@/mock/*', '@/mock'],
  message:
    'The UI must not import mock data — that breaks the backend swap. Take it through a service, or move the piece (labels, icons, clock) into lib/, components/, or the feature itself.',
};

const sharedLayerRestrictions = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@/features/*', '@/features'],
          message:
            'Shared layer must not depend on a feature. Move the shared piece down into components/, hooks/, lib/, or types/.',
        },
        noMockImports,
      ],
    },
  ],
};

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // The Code Review Standard: "avoid unnecessary `any`".
      // Error, not warn — an `any` must be argued for, not merged by default.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Type-only imports must say so. Keeps types out of the runtime bundle.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Shared layer: no reaching into features.
  {
    files: [
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
      'utils/**/*.{ts,tsx}',
    ],
    rules: sharedLayerRestrictions,
  },

  // Presentation layer: no direct service calls.
  // KFA: "Never call APIs directly from UI components."
  {
    files: ['components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/features'],
              message:
                'Shared components must not depend on a feature. Move it down a layer.',
            },
            {
              group: ['@/services/*', '@/services'],
              message:
                'UI components must not call services directly (KFA). Take data via props, or use a hook.',
            },
            noMockImports,
          ],
        },
      ],
    },
  },

  // Features and routes may call services, but never the mock behind them.
  {
    files: ['features/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'providers/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noMockImports] }],
    },
  },

  // Tests and mocks may reach anywhere, and may log.
  {
    files: ['**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}', 'mock/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },

  prettier,

  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      'node_modules/**',
    ],
  },
];

export default eslintConfig;
