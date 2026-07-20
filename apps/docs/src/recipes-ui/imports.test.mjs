import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, normalize, joinPath, resolveRelative, toVirtualKey, rewriteImports } from './imports.mjs';

test('path helpers', () => {
  assert.equal(dirname('recipe.ts'), '');
  assert.equal(dirname('capabilities/greet.ts'), 'capabilities');
  assert.equal(normalize('./a/../b'), 'b');
  assert.equal(joinPath('', './extensions'), 'extensions');
  assert.equal(joinPath('capabilities', '../extensions'), 'extensions');
  assert.equal(joinPath('', './capabilities/greet'), 'capabilities/greet');
});

const known = new Set(['recipe.ts', 'extensions.ts', 'capabilities/greet.ts', 'capabilities/scream.ts']);

test('resolveRelative finds .ts targets and skips bare specifiers', () => {
  assert.equal(resolveRelative('recipe.ts', './extensions', known), 'extensions.ts');
  assert.equal(resolveRelative('recipe.ts', './capabilities/greet', known), 'capabilities/greet.ts');
  assert.equal(resolveRelative('extensions.ts', './capabilities/scream', known), 'capabilities/scream.ts');
  assert.equal(resolveRelative('capabilities/greet.ts', '../extensions', known), 'extensions.ts');
  assert.equal(resolveRelative('recipe.ts', '@mycl/core', known), null);
});

test('resolveRelative throws on unknown target', () => {
  assert.throws(() => resolveRelative('recipe.ts', './nope', known), /Cannot resolve/);
});

test('rewriteImports rewrites relative specifiers to virtual keys, leaves bare ones', () => {
  const src = [
    "import { mycl } from '@mycl/core';",
    "import { greet } from './capabilities/greet';",
    "import { extensions } from './extensions';",
  ].join('\n');
  const resolveSpec = (spec) =>
    spec.startsWith('.') ? toVirtualKey(resolveRelative('recipe.ts', spec, known)) : null;
  const out = rewriteImports(src, resolveSpec);
  assert.match(out, /from '@mycl\/core'/);
  assert.match(out, /from 'virtual:capabilities\/greet\.ts'/);
  assert.match(out, /from 'virtual:extensions\.ts'/);
});

test('rewriteImports handles side-effect and multi-line imports', () => {
  const src = "import './setup';\nimport {\n  a,\n  b\n} from './capabilities/greet';";
  const resolveSpec = (spec) => (spec === './setup' ? 'virtual:setup.ts' : spec === './capabilities/greet' ? 'virtual:capabilities/greet.ts' : null);
  const out = rewriteImports(src, resolveSpec);
  assert.match(out, /import 'virtual:setup\.ts'/);
  assert.match(out, /from 'virtual:capabilities\/greet\.ts'/);
});

test('rewriteImports does not scan a from-specifier out of a following comment', () => {
  const known = new Set(['recipe.ts', 'setup.ts', 'capabilities/greet.ts']);
  const resolveSpec = (spec) =>
    spec.startsWith('.') ? toVirtualKey(resolveRelative('recipe.ts', spec, known)) : null;
  // A side-effect import (no `from`) then comment prose mentioning `from '...'`.
  const src = "import './setup';\n// ported from './old-thing' long ago\nimport { greet } from './capabilities/greet';";
  const out = rewriteImports(src, resolveSpec);
  assert.match(out, /import 'virtual:setup\.ts'/);                 // real side-effect import rewritten
  assert.match(out, /from 'virtual:capabilities\/greet\.ts'/);     // real from-import rewritten
  assert.match(out, /\/\/ ported from '\.\/old-thing' long ago/);  // comment untouched, and no throw
});

test('rewriteImports leaves a trailing line comment mentioning from untouched', () => {
  const known = new Set(['recipe.ts', 'capabilities/greet.ts']);
  const resolveSpec = (spec) =>
    spec.startsWith('.') ? toVirtualKey(resolveRelative('recipe.ts', spec, known)) : null;
  const src = "import { greet } from './capabilities/greet'; // see also from './scream'";
  const out = rewriteImports(src, resolveSpec);
  assert.match(out, /from 'virtual:capabilities\/greet\.ts'/);
  assert.match(out, /\/\/ see also from '\.\/scream'/);            // trailing comment untouched
});
