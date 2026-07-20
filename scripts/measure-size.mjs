// Measures consumer-facing bundle size for @mycl/core, now the single mycl
// package. Bundles each published entry with esbuild (treeshaken) and reports
// raw bytes and minified+gzipped bytes. Reproducible for before/after diffs.
//
// The budget gate is on the MAIN entry (`.`): importing createFnChannel and the
// everyday runtime pulls the kernel and the whole substrate, so that single
// bundle IS the full stack a consumer ships. The other subpaths (helpers,
// context, factory, introspect) are optional add-ons, measured for visibility;
// in a real app they dedupe against the main entry rather than stacking.
//
// The bundling recipe (production define, esm, treeshaken) lives in
// scripts/size-lib.mjs, shared with the docs splash figure.
import { ENTRIES, bundleEntry, gzSize } from './size-lib.mjs';

const fmt = (n) => `${n} B (${(n / 1024).toFixed(2)} KB)`;

const rows = [];
for (const t of ENTRIES) {
  const raw = await bundleEntry(t.entry, false);
  const min = await bundleEntry(t.entry, true);
  rows.push({ name: t.name, raw: raw.length, min: min.length, gz: gzSize(min) });
}

console.log('entry                  raw            min            min+gz');
for (const r of rows) {
  console.log(`${r.name.padEnd(22)} ${fmt(r.raw).padEnd(14)} ${fmt(r.min).padEnd(14)} ${fmt(r.gz)}`);
}

// The published claim: the full stack (the main entry, which pulls the kernel
// and substrate) stays under 2 KB min+gz. Enforced so CI fails on a size
// regression instead of silently outgrowing the pitch.
const fullStack = rows.find((r) => r.name === '@mycl/core');
const BUDGET_GZ = 2048;
console.log(`\nfull stack (main entry) min+gz: ${fmt(fullStack.gz)}`);
if (fullStack.gz > BUDGET_GZ) {
  console.error(`BUDGET EXCEEDED: full stack min+gz ${fmt(fullStack.gz)} > ${fmt(BUDGET_GZ)}`);
  process.exit(1);
}
console.log(`budget OK: ${fmt(fullStack.gz)} <= ${fmt(BUDGET_GZ)} min+gz`);
