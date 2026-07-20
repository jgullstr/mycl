import { defineConfig } from 'tsup';

const outExtension = () => ({ js: '.mjs' });

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'helpers': 'src/util/helpers.ts',
    'context/index': 'src/context/index.ts',
    'factory/index': 'src/factory/index.ts',
    'introspect': 'src/util/introspect.ts',
  },
  format: ['esm'],
  outExtension,
  dts: true,
  sourcemap: true,
  clean: true,
});
