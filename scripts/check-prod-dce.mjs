import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const bundle = async (entry, { prod, platform = 'neutral' }) => {
  const res = await build({
    entryPoints: [path.join(repo, entry)],
    bundle: true, format: 'esm', platform, write: false, minify: true,
    external: [],
    define: { ...(prod ? { 'process.env.NODE_ENV': '"production"' } : {}) },
    logLevel: 'silent',
  });
  // Guard against a vacuous pass: a degenerate build that still "succeeds".
  if (res.errors.length > 0) { console.error('FAIL: esbuild errors', res.errors); process.exit(1); }
  if (!res.outputFiles?.[0]?.contents?.length) { console.error('FAIL: empty bundle output'); process.exit(1); }
  return Buffer.from(res.outputFiles[0].contents).toString('utf8');
};

const size = (s) => { const b = Buffer.from(s); return `${b.length} B min, ${gzipSync(b, { level: 9 }).length} B min+gz`; };
const DEV_STRINGS = [
  'called outside any registry scope',
  'resolved to a non-function value',
  'Multiple copies are not supported',
  'received a builder',
  'cannot key the dispatch cache',
  'alsContext requires process.getBuiltinModule',
];

// ── The main entry: dev strings must fold out of the production bundle ────────
const dev = await bundle('packages/core/src/index.ts', { prod: false });
const prod = await bundle('packages/core/src/index.ts', { prod: true });
console.log('@mycl/core — dev :', size(dev));
console.log('@mycl/core — prod:', size(prod));

const leaked = DEV_STRINGS.filter((s) => prod.includes(s));
const coded = prod.includes('https://mycl.dev/errors/');
console.log('coded prod message present:', coded);
if (leaked.length > 0) { console.error('FAIL: dev strings leaked into prod bundle:', leaked); process.exit(1); }
if (!coded) { console.error('FAIL: coded prod message missing'); process.exit(1); }

// ── The /context entry must bundle for a BROWSER target ──────────────────────
// alsContext resolves node:async_hooks lazily via process.getBuiltinModule, so
// there is no static `import 'node:async_hooks'` to poison a browser bundle. A
// static import WOULD fail this platform:'browser' build (node: builtins do not
// resolve for the browser) — bundle() rejects on esbuild errors, so a green
// build here is itself the proof there is no static node import. We additionally
// assert the lazy accessor survives (the string argument to getBuiltinModule is
// the only, and expected, node:async_hooks reference) and that no dev strings
// leaked.
const ctxBrowser = await bundle('packages/core/src/context/index.ts', { prod: true, platform: 'browser' });
console.log('@mycl/core/context — browser prod:', size(ctxBrowser));
if (!ctxBrowser.includes('getBuiltinModule')) {
  console.error('FAIL: /context browser bundle lost the lazy getBuiltinModule accessor');
  process.exit(1);
}
const ctxLeaked = DEV_STRINGS.filter((s) => ctxBrowser.includes(s));
if (ctxLeaked.length > 0) { console.error('FAIL: dev strings leaked into /context prod bundle:', ctxLeaked); process.exit(1); }

console.log('OK: dev messages eliminated from prod bundle; /context is browser-safe');
