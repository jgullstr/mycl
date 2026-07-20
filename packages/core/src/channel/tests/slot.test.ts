import { describe, expect, it } from 'vitest';
import { createChannelInternal, setChannelContext, getChannelSlot } from '../slot';
import { resolveSnapshot } from '../../capability/resolveSnapshot';
import { CHANNEL_KEY } from '../symbols';
import type { ResolvedRegistry } from '../../registry/types';
import type { ScopeContext } from '../../context/types';

const makeRawCtx = (store = { val: undefined as ResolvedRegistry | undefined }): ScopeContext<ResolvedRegistry> => ({
  get: () => store.val,
  run: <T>(reg: ResolvedRegistry | undefined, fn: () => T): T => {
    store.val = reg;
    try {
      return fn();
    } finally {
      store.val = undefined;
    }
  },
});

const mockReg: ResolvedRegistry = { resolve: () => null };

describe('createChannelInternal', () => {
  it('returns frozen channel object with CHANNEL_KEY property', () => {
    const g = createChannelInternal('test', makeRawCtx());
    expect(Object.isFrozen(g)).toBe(true);
    expect(CHANNEL_KEY in g).toBe(true);
    expect(g.name).toBe('test');
  });

  it('each call produces a unique channel object', () => {
    const g1 = createChannelInternal('same-name', makeRawCtx());
    const g2 = createChannelInternal('same-name', makeRawCtx());
    expect(g1).not.toBe(g2);
    expect(g1[CHANNEL_KEY]).not.toBe(g2[CHANNEL_KEY]);
  });

  it('stores the context as-is — slot.current returns the same object', () => {
    const raw = makeRawCtx();
    const g = createChannelInternal('raw-identity', raw);
    expect(getChannelSlot(g).current).toBe(raw);
  });
});

describe('setChannelContext', () => {
  it('replaces the registered context', () => {
    const store1 = { val: undefined as ResolvedRegistry | undefined };
    const store2 = { val: undefined as ResolvedRegistry | undefined };
    const g = createChannelInternal('swap', makeRawCtx(store1));
    setChannelContext(g, makeRawCtx(store2));
    const ctx = getChannelSlot(g).current;
    let ranInStore2 = false;
    ctx.run(mockReg, () => {
      ranInStore2 = store2.val === mockReg;
    });
    expect(ranInStore2).toBe(true);
    expect(store1.val).toBeUndefined();
  });

  it('throws for plain objects without CHANNEL_KEY', () => {
    const fake = { name: 'fake' };
    expect(() => setChannelContext(fake as any, makeRawCtx())).toThrow('invalid channel');
  });

  it('rejects a context that already backs another channel (dev)', () => {
    const shared = makeRawCtx();
    createChannelInternal('ctx-owner', shared);
    const other = createChannelInternal('ctx-thief', makeRawCtx());
    expect(() => setChannelContext(other, shared)).toThrow('already backs channel "ctx-owner"');
  });

  it('rejects a shared context at channel creation (dev)', () => {
    const shared = makeRawCtx();
    createChannelInternal('ctx-first', shared);
    expect(() => createChannelInternal('ctx-second', shared)).toThrow('already backs channel "ctx-first"');
  });

  it('re-installing a context on its own channel is fine', () => {
    const ctx = makeRawCtx();
    const g = createChannelInternal('ctx-reinstall', ctx);
    expect(() => setChannelContext(g, ctx)).not.toThrow();
  });

  it('snapshot capture works against the swapped-in context', () => {
    const g = createChannelInternal('swap-snap', makeRawCtx());
    const store2 = { val: undefined as ResolvedRegistry | undefined };
    setChannelContext(g, makeRawCtx(store2));
    const ctx = getChannelSlot(g).current;
    const snapshot = resolveSnapshot(g);
    let bound: (() => void) | undefined;
    let seen: ResolvedRegistry | undefined;
    ctx.run(mockReg, () => {
      bound = snapshot(() => {
        seen = store2.val;
      });
    });
    bound!();
    expect(seen).toBe(mockReg);
  });
});
