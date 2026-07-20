// Smoke-tests the PUBLISHED artifact, not the source.
//
// The vitest suites alias @mycl/core to packages/core/src, so nothing there ever
// loads dist/ or honours the exports map. This packs the package exactly as
// `pnpm publish` would, installs the tarball into a throwaway consumer, then
// loads every entry and subpath through BOTH `import` and `require` and runs a
// real dispatch + introspection round-trip.
//
// It guards two things the unit tests structurally cannot:
//   1. the exports map resolves for every subpath, from ESM and CJS;
//   2. the single-copy symbol invariant holds across entries in the shipped
//      build (the bug that made the old CJS artifacts throw at import).
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = [
  { name: '@mycl/core', dir: path.join(repo, 'packages/core') },
];

// shell:true is needed for pnpm/npm on Windows (.cmd resolution), but it breaks
// argv0 paths containing spaces (e.g. C:\Program Files\nodejs\node.exe), so node
// itself is spawned without a shell.
const run = (cmd, args, { shell = false, ...opts } = {}) => {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell, ...opts });
  if (res.status !== 0) {
    console.error(`FAIL: ${cmd} ${args.join(' ')}\n${res.stdout ?? ''}\n${res.stderr ?? ''}`);
    process.exit(1);
  }
  return res.stdout ?? '';
};

const scratch = mkdtempSync(path.join(tmpdir(), 'mycl-smoke-'));

try {
  // Pack the package into the scratch dir.
  const tarballs = {};
  for (const pkg of packages) {
    run('pnpm', ['pack', '--pack-destination', scratch], { cwd: pkg.dir, shell: true });
  }
  for (const file of readdirSync(scratch)) {
    if (!file.endsWith('.tgz')) continue;
    if (file.startsWith('mycl-core-')) tarballs['@mycl/core'] = path.join(scratch, file);
  }
  for (const pkg of packages) {
    if (!tarballs[pkg.name]) { console.error(`FAIL: no tarball produced for ${pkg.name}`); process.exit(1); }
  }

  // A clean, non-workspace consumer. npm (not pnpm) so the tarball is copied
  // in as a real installed package, no workspace symlink aliasing to defeat the test.
  const consumerPkg = {
    name: 'mycl-smoke-consumer',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: {
      '@mycl/core': `file:${tarballs['@mycl/core']}`,
    },
  };
  writeFileSync(path.join(scratch, 'package.json'), JSON.stringify(consumerPkg, null, 2));
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: scratch, shell: true });

  // The shared round-trip body, run identically under ESM and CJS. `M` is a map
  // of every published entry/subpath's namespace, so a missing export or a
  // failed subpath resolution surfaces here.
  const body = `
  // Every subpath resolved to a real module.
  assert.equal(typeof M.coreIndex.createFnChannel, 'function', 'core index (createFnChannel)');
  assert.equal(typeof M.coreIndex.registry, 'function', 'core index (registry)');
  assert.equal(typeof M.coreIndex.requires, 'function', 'core index (requires)');
  assert.equal(typeof M.coreIndex.setChannelContext, 'function', 'core index (setChannelContext)');
  assert.equal(M.coreIndex.merge, undefined, 'merge must NOT be on the main entry (lives on /factory)');
  assert.equal(typeof M.coreHelpers.before, 'function', 'core/helpers');
  assert.equal(typeof M.coreContext.stackContext, 'function', 'core/context (stackContext)');
  assert.equal(typeof M.coreContext.alsContext, 'function', 'core/context (alsContext)');
  assert.equal(typeof M.coreFactory.createChannel, 'function', 'core/factory (createChannel)');
  assert.equal(typeof M.coreFactory.merge, 'function', 'core/factory (merge)');
  assert.equal(typeof M.coreFactory.foldBindings, 'function', 'core/factory (foldBindings)');
  assert.equal(typeof M.coreIntrospect.describe, 'function', 'core/introspect');

  // Round-trip 1: the userland front door (bound factory). Crosses the main
  // entry (createFnChannel + registry) then introspect. describe().identity being
  // defined is the exact property the old duplicated-symbol CJS build got wrong.
  const k = M.coreIndex.createFnChannel('smoke.default');
  const cap = k.capable((x) => x * 2, 'smoke/default');
  const reg = M.coreIndex.registry().layer(cap, (x) => x * 100);
  const app = k.mycl(() => ({ calc: k.snapshot((x) => cap(x)) }), reg)();
  assert.equal(app.calc(5), 500, 'channel dispatch');
  const rows = M.coreIntrospect.describe(reg);
  assert.equal(rows.length, 1, 'introspect row count');
  // Identity is channel-namespaced (smoke.default:smoke/default). Asserting it is
  // a non-empty string ending in the id catches the old CJS bug, where a foreign
  // CAPABILITY_ID symbol made describe() return identity: undefined.
  assert.ok(
    typeof rows[0].identity === 'string' && rows[0].identity.endsWith('smoke/default'),
    'introspect identity (single-copy invariant), got: ' + rows[0].identity,
  );

  // Round-trip 2: the REAL alsContext (Node) swapped onto a second channel, then
  // an async factory that dispatches a capability AFTER an await inside its mycl
  // scope. With a stack context that scope would be gone post-await; ALS carries
  // it, so the dispatch still resolves. This exercises the context swap path
  // (main setChannelContext + /context alsContext) and the packed artifact's
  // single shared channel-slot module.
  const g = M.coreIndex.createFnChannel('smoke-als');
  M.coreIndex.setChannelContext(g.channel, M.coreContext.alsContext());
  const acap = g.capable((x) => x + 1, 'smoke/als');
  const areg = M.coreIndex.registry().layer(acap, (x) => x + 41);
  const asyncFactory = g.mycl(async (seed) => {
    await Promise.resolve();
    return acap(seed); // dispatched after await; ALS keeps the scope alive
  }, areg);
  assert.equal(await asyncFactory(5), 46, 'als scope survives await (5 + 41)');
  `;

  const esmConsumer = `
  import assert from 'node:assert/strict';
  import * as coreIndex from '@mycl/core';
  import * as coreHelpers from '@mycl/core/helpers';
  import * as coreContext from '@mycl/core/context';
  import * as coreFactory from '@mycl/core/factory';
  import * as coreIntrospect from '@mycl/core/introspect';
  const M = { coreIndex, coreHelpers, coreContext, coreFactory, coreIntrospect };
  await (async () => {
  ${body}
  })();
  console.log('esm smoke OK');
  `;

  const cjsConsumer = `
  const assert = require('node:assert/strict');
  const M = {
    coreIndex: require('@mycl/core'),
    coreHelpers: require('@mycl/core/helpers'),
    coreContext: require('@mycl/core/context'),
    coreFactory: require('@mycl/core/factory'),
    coreIntrospect: require('@mycl/core/introspect'),
  };
  (async () => {
  ${body}
  })().then(() => console.log('cjs smoke OK'), (e) => { console.error(e); process.exit(1); });
  `;

  writeFileSync(path.join(scratch, 'consumer.mjs'), esmConsumer);
  writeFileSync(path.join(scratch, 'consumer.cjs'), cjsConsumer);

  process.stdout.write(run(process.execPath, ['consumer.mjs'], { cwd: scratch }));

  // require(esm) shipped unflagged in Node 22.12 and was backported to 20.19
  // (process.features.require_module where available). Below those, a CJS
  // consumer cannot synchronously require an ESM-only package by Node's own
  // design, so the CJS round-trip proves nothing there: skip it rather than
  // fail on a capability the runtime does not have.
  const [maj, min] = process.versions.node.split('.').map(Number);
  const canRequireEsm = process.features.require_module
    ?? (maj >= 23 || (maj === 22 && min >= 12) || (maj === 20 && min >= 19));
  if (canRequireEsm) {
    process.stdout.write(run(process.execPath, ['consumer.cjs'], { cwd: scratch }));
    console.log('OK: packed artifact loads and round-trips through import() and require()');
  } else {
    console.log(`skip: require(esm) unavailable on Node ${process.versions.node}; CJS consumer not run`);
    console.log('OK: packed artifact loads and round-trips through import()');
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
