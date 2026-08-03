// Emits src/generated/coverage.json for the splash page, so the published
// coverage claim tracks the measurement the CI gate enforces instead of a
// hand-edited literal. Same arrangement as generate-size.mjs.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const summaryPath = join(root, 'packages/core/coverage/coverage-summary.json');

// Root `pnpm build` runs builds only, never tests, so on a clean checkout (a
// Cloudflare Pages deploy, say) the summary does not exist yet. Produce it
// rather than publish a claim sourced from nothing. A red suite failing the
// docs build is the correct consequence.
if (!existsSync(summaryPath)) {
  console.log('generate-coverage: no coverage summary, running the core suite under coverage...');
  execFileSync('pnpm', ['--filter', '@mycl/core', 'test:coverage'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const { total } = JSON.parse(readFileSync(summaryPath, 'utf8'));

// The minimum across the four metrics, floored: the published figure may
// understate coverage, never overstate it. Mirrors the size figure's ceiling.
const pct = Math.floor(
  Math.min(total.statements.pct, total.branches.pct, total.functions.pct, total.lines.pct),
);

const outDir = join(here, '../src/generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'coverage.json'), `${JSON.stringify({ pct }, null, 2)}\n`);

console.log(`Wrote src/generated/coverage.json: ${pct}% (min of statements/branches/functions/lines)`);
