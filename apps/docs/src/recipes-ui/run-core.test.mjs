import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSrcDoc, IFRAME_RUNTIME } from './srcdoc.mjs';
import { prepareRun } from './run-core.mjs';

test('buildSrcDoc embeds import map, runtime and entry import', () => {
  const html = buildSrcDoc({
    imports: { '@mycl/core': 'blob:core', 'virtual:recipe.ts': 'blob:r' },
    runtime: 'RUNTIME',
    entryKey: 'virtual:recipe.ts',
  });
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /"virtual:recipe\.ts":"blob:r"/);
  assert.match(html, /RUNTIME/);
  assert.match(html, /import "virtual:recipe\.ts"/);
});

test('IFRAME_RUNTIME forwards console output to the parent', () => {
  assert.match(IFRAME_RUNTIME, /postMessage/);
  assert.match(IFRAME_RUNTIME, /mycl-pg/);
});

test('prepareRun builds a virtual-key module graph', () => {
  const files = {
    'recipe.ts': "import { greet } from './capabilities/greet';\ngreet('x');",
    'capabilities/greet.ts': "import { capable } from '@mycl/core';\nexport const greet = capable(() => 'hi', 'greet');",
  };
  let n = 0;
  const { srcdoc, urls } = prepareRun({
    files,
    entry: 'recipe.ts',
    coreUrl: 'blob:core',
    transpile: (ts) => ts, // identity: assert wiring, not TS transform
    makeUrl: () => `blob:${n++}`,
  });
  assert.equal(urls.length, 2);
  // recipe's relative import rewritten to the virtual key of greet
  assert.match(srcdoc, /"virtual:recipe\.ts":/);
  assert.match(srcdoc, /"virtual:capabilities\/greet\.ts":/);
  assert.match(srcdoc, /"@mycl\/core":"blob:core"/);
  assert.match(srcdoc, /"@mycl\/core\/helpers":"blob:core"/);
  assert.match(srcdoc, /import "virtual:recipe\.ts"/);
});
