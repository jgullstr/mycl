import { defineConfig } from 'vitest/config';

// Self-aliases so the kernel suites can import the substrate through its
// published entry points and resolve to source, exactly as the built package's
// exports map does for consumers.
export default defineConfig({
  test: {
    globals: false,
    poolOptions: { forks: { execArgv: ['--expose-gc'] } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // types.ts modules are type-only: no runtime to execute, and v8 reports
      // an empty file as 0%, which would fail a threshold nothing can satisfy.
      exclude: ['src/**/tests/**', 'src/**/types.ts'],
      // lcov feeds the Codecov upload; json-summary feeds the splash figure
      // (apps/docs/scripts/generate-coverage.mjs).
      reporter: ['text', 'lcov', 'json-summary'],
      // 100 is a rule rather than a number to re-tune each change. The two
      // paths that stood between the suite and 100 are closed: merge()'s
      // already-resolved guard now has a test, and registry.ts's augment probe
      // carries a v8 ignore because nothing ever invokes it.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
  resolve: {
    alias: {
      '@mycl/core/factory': new URL('./src/factory/index.ts', import.meta.url).pathname,
      '@mycl/core/helpers': new URL('./src/util/helpers.ts', import.meta.url).pathname,
      '@mycl/core/context': new URL('./src/context/index.ts', import.meta.url).pathname,
      '@mycl/core/introspect': new URL('./src/util/introspect.ts', import.meta.url).pathname,
      '@mycl/core': new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
});
