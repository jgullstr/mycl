import { build } from 'esbuild';
import { generateDtsBundle } from 'dts-bundle-generator';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(here, '../src/playground/vendor');
await mkdir(outdir, { recursive: true });

// One package, @mycl/core, with subpath entries. The main entry (createFnChannel,
// registry, merge, requires, setChannelContext, the guards, and
// the full type vocabulary) covers everything the guide/recipe fences use;
// /helpers (before, after, pipe, handleError) is deliberately not on main, so
// runnable fences that augment need it too. Bundle both into ONE esbuild output
// so the playground and recipes runner still load a single @mycl/core instance;
// deps.ts/monaco-setup.ts mount that one bundle at both the '@mycl/core' and
// '@mycl/core/helpers' virtual specifiers. Add '@mycl/core/context' here only if
// a runnable (Playground/recipe) fence ends up importing alsContext/stackContext;
// today those are shown as static code (Node built-ins the sandbox can't run).
await build({
  stdin: {
    contents: `export * from '@mycl/core';\nexport * from '@mycl/core/helpers';`,
    resolveDir: resolve(here, '..'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  // Inline EVERYTHING so Sandpack resolves one file.
  external: [],
  outfile: resolve(outdir, 'mycl-core.bundle.js'),
  legalComments: 'none',
});

console.log('Built playground bundle: src/playground/vendor/mycl-core.bundle.js');

// Bundle @mycl/core's type declarations (main + /helpers) into one self-contained
// .d.ts for Monaco's IntelliSense. We inline the already-built dist types of
// @mycl/core (clean declaration files, free of the source's ambient globals) into
// a single module file via dts-bundle-generator.
const [dts] = generateDtsBundle(
  [
    {
      filePath: resolve(here, 'dts/entry.ts'),
      libraries: { inlinedLibraries: ['@mycl/core'] },
      output: { noBanner: true, inlineDeclareExternals: true },
    },
  ],
  { preferredConfigPath: resolve(here, 'dts/tsconfig.json') },
);
await writeFile(resolve(outdir, 'mycl-core.bundle.d.ts'), dts);

console.log('Built playground types:  src/playground/vendor/mycl-core.bundle.d.ts');
