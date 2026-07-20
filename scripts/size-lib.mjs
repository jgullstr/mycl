// Shared measurement recipe for the size gate (scripts/measure-size.mjs) and
// the docs splash figure (apps/docs/scripts/generate-size.mjs): one bundling
// and compression setup, so the enforced number and the published number
// cannot drift.
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ENTRIES = [
  { name: '@mycl/core',            entry: 'packages/core/src/index.ts' },
  { name: '@mycl/core/helpers',    entry: 'packages/core/src/util/helpers.ts' },
  { name: '@mycl/core/context',    entry: 'packages/core/src/context/index.ts' },
  { name: '@mycl/core/factory',    entry: 'packages/core/src/factory/index.ts' },
  { name: '@mycl/core/introspect', entry: 'packages/core/src/util/introspect.ts' },
];

export const bundleEntry = async (entry, minify) => {
  const res = await build({
    entryPoints: [path.join(repo, entry)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    minify,
    // NODE_ENV=production folds the dev-error gates so MESSAGES/fmt drop out —
    // measures the prod footprint a consumer ships, not the dev build.
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  return Buffer.from(res.outputFiles[0].contents);
};

export const gzSize = (buf) => gzipSync(buf, { level: 9 }).length;
