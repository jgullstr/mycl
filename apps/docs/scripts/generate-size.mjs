// Measures the main entry with the same recipe as the root size gate
// (scripts/size-lib.mjs) and emits src/generated/size.json for the splash
// page, so the published figure tracks the measurement instead of a
// hand-edited literal.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ENTRIES, bundleEntry, gzSize } from '../../../scripts/size-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const main = ENTRIES.find((e) => e.name === '@mycl/core');
const gzBytes = gzSize(await bundleEntry(main.entry, true));
// Ceil to one decimal: the published figure may overstate the size, never
// understate it.
const kb = (Math.ceil((gzBytes / 1024) * 10) / 10).toFixed(1);

// The version the figure was measured against, so the published claim is
// pinned to a release rather than floating.
const { version } = JSON.parse(
  readFileSync(join(here, '../../../packages/core/package.json'), 'utf8'),
);

const outDir = join(here, '../src/generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'size.json'), `${JSON.stringify({ gzBytes, kb, version }, null, 2)}\n`);

console.log(`Wrote src/generated/size.json: main entry ${gzBytes} B min+gz (${kb} KB) at v${version}`);
