/**
 * @file
 * One flat config for the whole monorepo, applied to every package source tree. A well-known
 * base (ESLint recommended + typescript-eslint recommended + @stylistic) tuned to the house
 * style: airy code (braces on every control statement, one statement per line), arrow-const
 * functions, consistent formatting. Softer guidelines (no em dashes, no section dividers,
 * docblocks on exports) are review practice, not lint. apps/ (the docs site) and
 * scripts/ (repo tooling) keep out of scope.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.claude/**',
      '**/.worktrees/**',
      'apps/**',
      'scripts/**',
      // Lint package source only, not build configs or root-level scratch files.
      'packages/*/*.ts',
      'packages/*/*.tsx',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: true,
    braceStyle: '1tbs',
    arrowParens: true,
    commaDangle: 'always-multiline',
    jsx: true,
  }),
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      curly: ['error', 'all'],
      '@stylistic/curly-newline': ['error', { minElements: 1 }],
      '@stylistic/max-statements-per-line': ['error', { max: 1 }],
      // Keep the TSX generic-arrow disambiguation comma (`<T,>`); comma-dangle would strip it.
      '@stylistic/comma-dangle': ['error', {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'always-multiline',
        enums: 'always-multiline',
        generics: 'ignore',
        tuples: 'always-multiline',
      }],

      // Arrow-const functions. Function expressions and arrows are fine; `function`
      // declarations are not.
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],

      // A `let` that is read (in a closure) before its single assignment genuinely needs `let`.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],

      // Keep quotes on numeric-string keys: `{ '0': ... }` is a STRING key, `{ 0: ... }` a
      // numeric one, and `keyof T & string` treats them differently. Stripping them is unsafe.
      '@stylistic/quote-props': ['error', 'as-needed', { numbers: true }],

      // Deliberate mycl idioms, not smells:
      //   `any`        carries capability payloads across erased registry boundaries
      //                (any-containment is a tested type-level contract).
      //   `{}`         is the empty-context default.
      //   non-null `!` asserts presence the registry has already resolved.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Unused args/vars prefixed with _ are intentional (signature-shaped params, etc.).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      // React components are conventionally function declarations; the arrow-only rule is
      // aimed at the functional core, not JSX component definitions.
      'func-style': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test-d.ts'],
    rules: {
      // Tests declare fixtures and assert types with bare expressions; that is their job.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
);
