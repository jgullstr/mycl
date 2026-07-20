import { defineConfig } from 'vitest/config';

// Self-aliases so the kernel suites can import the substrate through its
// published entry points and resolve to source, exactly as the built package's
// exports map does for consumers.
export default defineConfig({
  test: {
    globals: false,
    poolOptions: { forks: { execArgv: ['--expose-gc'] } },
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
