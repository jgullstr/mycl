import { describe, expect, it } from 'vitest';
import { resolveCapable } from '../resolveCapable';
import { resolveSnapshot } from '../resolveSnapshot';
import { createChannelInternal, getChannelSlot, setChannelContext } from '../../channel/slot';
import { CAPABILITY_TAG } from '../symbols';
import type { ResolvedRegistry } from '../../registry/types';
import type { ScopeContext } from '../../context/types';

const makeReg = (): ResolvedRegistry => ({ resolve: () => null });

/** Single-slot context with an inspectable store. */
const makeSlotCtx = () => {
  const store = { val: undefined as ResolvedRegistry | undefined };
  const ctx: ScopeContext<ResolvedRegistry> = {
    get: () => store.val,
    run: <T>(reg: ResolvedRegistry | undefined, fn: () => T): T => {
      const prev = store.val;
      store.val = reg;
      try {
        return fn();
      } finally {
        store.val = prev;
      }
    },
  };
  return { ctx, store };
};

describe('resolveSnapshot', () => {
  it('throws for objects without CHANNEL_KEY, eagerly at factory time', () => {
    expect(() => resolveSnapshot({ name: 'fake' } as any)).toThrow('invalid channel');
  });

  it('captures no-scope and shadows ambient scope at call time', () => {
    const { ctx } = makeSlotCtx();
    const g = createChannelInternal('sf-noscope', ctx);
    const fn = () => ctx.get();
    const snapped = resolveSnapshot(g)(fn);
    expect(snapped).not.toBe(fn);
    // calling inside someone else's scope must NOT adopt it
    const ambient = makeReg();
    expect(ctx.run(ambient, () => snapped())).toBeUndefined();
  });

  it('captures the current registry at snapshot time and replays it on call', () => {
    const { ctx } = makeSlotCtx();
    const g = createChannelInternal('sf-capture', ctx);
    const snapshot = resolveSnapshot(g);
    const reg = makeReg();
    let seen: ResolvedRegistry | undefined;
    let bound: (() => void) | undefined;
    ctx.run(reg, () => {
      bound = snapshot(() => {
        seen = ctx.get();
      });
    });
    expect(ctx.get()).toBeUndefined(); // scope has exited
    bound!();
    expect(seen).toBe(reg);
  });

  it('nested same-channel scopes: captures the innermost registry only', () => {
    const { ctx } = makeSlotCtx();
    const g = createChannelInternal('sf-nested', ctx);
    const snapshot = resolveSnapshot(g);
    const reg1 = makeReg();
    const reg2 = makeReg();
    let seen: ResolvedRegistry | undefined;
    let bound: (() => void) | undefined;
    ctx.run(reg1, () => {
      ctx.run(reg2, () => {
        bound = snapshot(() => {
          seen = ctx.get();
        });
      });
    });
    bound!();
    expect(seen).toBe(reg2);
  });

  it('composes across channels — snapA(snapB(fn)) replays both scopes', () => {
    const a = makeSlotCtx();
    const b = makeSlotCtx();
    const gA = createChannelInternal('sf-comp-a', a.ctx);
    const gB = createChannelInternal('sf-comp-b', b.ctx);
    const snapA = resolveSnapshot(gA);
    const snapB = resolveSnapshot(gB);
    const regA = makeReg();
    const regB = makeReg();
    let seenA: ResolvedRegistry | undefined;
    let seenB: ResolvedRegistry | undefined;
    let bound: (() => void) | undefined;
    a.ctx.run(regA, () => {
      b.ctx.run(regB, () => {
        bound = snapA(snapB(() => {
          seenA = a.ctx.get();
          seenB = b.ctx.get();
        }));
      });
    });
    bound!();
    expect(seenA).toBe(regA);
    expect(seenB).toBe(regB);
  });

  it('preserves async return values', async () => {
    const { ctx } = makeSlotCtx();
    const g = createChannelInternal('sf-async', ctx);
    const snapshot = resolveSnapshot(g);
    let bound: (() => Promise<string>) | undefined;
    ctx.run(makeReg(), () => {
      bound = snapshot(async () => 'ok');
    });
    expect(await bound!()).toBe('ok');
  });

  it('preserves this binding', () => {
    const { ctx } = makeSlotCtx();
    const g = createChannelInternal('sf-this', ctx);
    const snapshot = resolveSnapshot(g);
    const multiply = function (this: { n: number }, x: number) {
      return this.n * x;
    };
    let bound: typeof multiply | undefined;
    ctx.run(makeReg(), () => {
      bound = snapshot(multiply);
    });
    expect(bound!.call({ n: 4 }, 5)).toBe(20);
  });

  it('de-brands a capability — result has no CAPABILITY_TAG and dispatches in scope', () => {
    const { ctx } = makeSlotCtx();
    const g = createChannelInternal('sf-debrand', ctx);
    const snapshot = resolveSnapshot(g);
    const cap = resolveCapable(g)(() => 'result', 't/debrand');
    let snapped: (() => string) | undefined;
    ctx.run(makeReg(), () => {
      snapped = snapshot(cap);
    });
    expect(snapped!()).toBe('result');
    expect(CAPABILITY_TAG in snapped!).toBe(false);
  });

  it('honors a setChannelContext swap between capture and call', () => {
    const first = makeSlotCtx();
    const second = makeSlotCtx();
    const g = createChannelInternal('sf-swap', first.ctx);
    const snapshot = resolveSnapshot(g);
    const reg = makeReg();
    let seen: ResolvedRegistry | undefined;
    let bound: (() => void) | undefined;
    first.ctx.run(reg, () => {
      bound = snapshot(() => {
        seen = second.store.val;
      });
    });
    setChannelContext(g, second.ctx);
    bound!();
    // replay looked up the context at call time — the captured reg ran through `second`
    expect(seen).toBe(reg);
  });

  it('captures task-local scope from an async-store-style context', () => {
    // Models AsyncLocalStorage: get/run read a store keyed by the "current task".
    // The capture must hold task A's registry even while task B's scope is open.
    let currentTask = 'A';
    const stores = new Map<string, ResolvedRegistry | undefined>();
    const g = createChannelInternal('sf-als', {
      get: () => stores.get(currentTask),
      run: <T>(reg: ResolvedRegistry | undefined, fn: () => T): T => {
        const task = currentTask;
        const prev = stores.get(task);
        stores.set(task, reg);
        try {
          return fn();
        } finally {
          stores.set(task, prev);
        }
      },
    });
    const ctx = getChannelSlot(g).current;
    const snapshot = resolveSnapshot(g);
    const regA = makeReg();
    const regB = makeReg();

    let bound: (() => ResolvedRegistry | undefined) | undefined;
    ctx.run(regA, () => { // task A enters its scope
      currentTask = 'B';
      ctx.run(regB, () => { // task B's scope is open concurrently
        currentTask = 'A'; // scheduler switches back to task A
        bound = snapshot(() => stores.get(currentTask));
        currentTask = 'B';
      });
      currentTask = 'A';
    });

    expect(bound!()).toBe(regA); // not regB — task isolation
  });
});
