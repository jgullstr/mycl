import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Generate one Starlight page per mycl error code, served at /errors/<code> —
// the targets of the production error message `mycl: error <code>, visit
// https://mycl.dev/errors/<code>`. The single source of truth is core's MESSAGES
// table; we bundle errors.ts and read it directly so the pages can never drift
// from the runtime codes (the committed docs/errors.json can go stale).

const here = dirname(fileURLToPath(import.meta.url));
const errorsSrc = resolve(here, '../../../packages/core/src/util/errors.ts');
const outDir = resolve(here, '../src/content/docs/errors');

const res = await build({
  entryPoints: [errorsSrc],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'silent',
});
const bundled = Buffer.from(res.outputFiles[0].contents).toString('utf8');
const mod = await import(`data:text/javascript,${encodeURIComponent(bundled)}`);
const messages = mod.MESSAGES;

const codes = Object.keys(messages)
  .map(Number)
  .sort((a, b) => a - b);

const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

// ── Per-code production-emission classification ────────────────────────────
// Derived by reading the actual call sites in packages/core/src. One category
// deviates from the default; everything else throws unconditionally in every
// environment (full message in dev, coded message in prod).
//
// DEV_ONLY — the guard itself lives inside an inline
// `process.env.NODE_ENV !== 'production'` gate, so a consumer's bundler
// dead-code-eliminates the whole check from a production build. The code can
// never fire — thrown or logged — in production; there is no coded message
// for it there.
//   9  ERR_AUGMENT_BUILDER        — registry.ts `augment()` canary probe, inside the dev gate.
//   10 ERR_AUGMENT_CANARY_THREW   — registry.ts `augment()` canary probe, inside the dev gate.
//   11 ERR_INVALID_IDENTITY       — resolveCapable.ts identifier guard, inside the dev gate.
//   12 ERR_INVALID_CHANNEL_NAME   — createChannel.ts channel-name guard, inside the dev gate.
//   13 ERR_DUPLICATE_IDENTITY     — resolveCapable.ts duplicate guard, inside the dev gate (a
//                                   `console.error`, not a throw, even in development).
//   15 ERR_MERGE_RESOLVED         — merge.ts re-compose guard, inside the dev gate.
//   16 ERR_CONTEXT_IN_USE         — slot.ts context-ownership guard, inside the dev gate.
//   (Codes 3 ERR_INVALID_CHANNEL, 4 ERR_SYMBOL_FOR_KEY, and 14 ERR_NO_ASYNC_HOOKS were
//   also checked and are NOT dev-only — they throw unconditionally via errMsg with no
//   NODE_ENV gate around the check itself, so they fall through to the default
//   classification below.)
const DEV_ONLY = new Set([9, 10, 11, 12, 13, 15, 16]);

const prodUrlMsg = (code) =>
  `mycl: error ${code}, visit https://mycl.dev/errors/${code} for more information.`;

const tailFor = (code) => {
  if (DEV_ONLY.has(code)) {
    return `This is a development-only check. The guard is wrapped in an inline \`process.env.NODE_ENV !== 'production'\` gate in the source, so a production bundler dead-code-eliminates it entirely. Error ${code} can never be thrown or logged in a production build, and there is no coded production message for it.`;
  }
  return `The text above is the full development message for this code. In production mycl throws \`${prodUrlMsg(code)}\` instead.`;
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const code of codes) {
  const msg = String(messages[code]);
  const page = `---
title: Error ${code}
description: ${JSON.stringify(oneLine(msg))}
sidebar:
  order: ${code}
  label: Error ${code}
---

:::danger[mycl error ${code}]
\`\`\`text
${msg}
\`\`\`
:::

Placeholders such as \`{name}\` are filled with specifics when this code fires.

${tailFor(code)}
`;
  await writeFile(resolve(outDir, `${code}.md`), page);
}

const rows = codes
  .map((code) => `| [${code}](/errors/${code}/) | ${oneLine(String(messages[code])).replace(/\|/g, '\\|')} |`)
  .join('\n');

const index = `---
title: Error reference
description: Reference for mycl's coded runtime errors.
sidebar:
  order: 0
  label: Overview
---

Most of mycl's runtime checks throw in production as compact **coded** errors
of the form \`mycl: error <code>, visit https://mycl.dev/errors/<code> for more
information.\`: the full message strings are stripped from production
bundles to keep them small. A few validation checks (errors ${[...DEV_ONLY].sort((a, b) => a - b).join(', ')})
are **development-only**, where the guard itself is stripped from production
builds entirely, so those codes can never fire there. In development the
complete message is thrown (or logged) inline for every code. Each page below
states its own production behavior explicitly.

| Code | Message |
|------|---------|
${rows}
`;
await writeFile(resolve(outDir, 'index.md'), index);

console.log(`Generated ${codes.length} error pages: src/content/docs/errors/`);
