import { describe, expect, it } from 'vitest';
import { resolveCapable } from '../resolveCapable';
import { createChannelInternal } from '../../channel/slot';
import { registry } from '../../registry/registry';
import { merge } from '../../registry/merge';
import { makeResolvedRegistry } from '../../registry/resolvedRegistry';
import stackContext from '../../context/stack';

const gc = (globalThis as { gc?: () => void }).gc;

/**
 * Polls gc() in a separate macrotask scope so the async test frame (which
 * holds `ref` in scope) is not on the stack when gc() runs — V8 would
 * otherwise retain the frame and its captured locals across await boundaries.
 */
const waitForCollection = (ref: WeakRef<object>): Promise<object | undefined> =>
  new Promise((resolve) => {
    let attempts = 0;
    const tryGC = () => {
      gc!();
      if (ref.deref() === undefined || attempts++ >= 5) {
        resolve(ref.deref());
      } else {
        setTimeout(tryGC, 10);
      }
    };
    setTimeout(tryGC, 0);
  });

describe('dispatch cache release', () => {
  it.runIf(typeof gc === 'function')(
    'releases cached resolved functions when the source registry is collected',
    { retry: 2 },
    async () => {
      // Strong Map failure mode: cache.set(sym, impl) retains impl forever via
      // the cache value — WeakRef(impl).deref() stays defined and the test fails.
      const ctx = stackContext();
      const g = createChannelInternal('leak-test', ctx);
      const cap = resolveCapable(g)(() => 'base', 't/leakBase');

      // Build, dispatch (populates the cap's dispatch cache), drop all strong refs.
      // Track impl (the layered fn stored as the cache value) — not reg, which is
      // weakly reachable either way and therefore not a discriminating referent.
      const makeAndDispatch = (): WeakRef<object> => {
        const impl = () => 'layered';
        const reg = registry().layer(cap, impl);
        const resolved = merge(reg);
        ctx.run(resolved, () => {
          cap();
        });
        return new WeakRef(impl);
      };

      const ref = makeAndDispatch();
      await waitForCollection(ref);
      expect(ref.deref()).toBeUndefined();
    },
  );

  it('rejects registered symbols as dispatch syms', () => {
    expect(() => makeResolvedRegistry(() => null, Symbol.for('mycl.test.registered')))
      .toThrow('registered symbol');
  });
});
