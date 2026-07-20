import { describe, expect, it } from 'vitest';
import { createChannel } from '../createChannel';
import { setChannelContext } from '../slot';
import { CAPABILITY_TAG } from '../../capability/symbols';
import { CHANNEL_KEY } from '../symbols';
import type { ResolvedRegistry } from '../../registry/types';
import type { ScopeContext } from '../../context/types';
import { connectorOf } from '../../tests/connectorOf';

const passthrough = () => ({
  get: (): ResolvedRegistry => ({ resolve: () => null }),
  run: <T>(_: ResolvedRegistry | undefined, fn: () => T): T => fn(),
});

const noScope = () => ({
  get: (): ResolvedRegistry | undefined => undefined,
  run: <T>(_: ResolvedRegistry | undefined, fn: () => T): T => fn(),
});

describe('createChannel', () => {
  it('returns frozen channel token with CHANNEL_KEY property and name', () => {
    const { channel } = createChannel('test', connectorOf(noScope()));
    expect(Object.isFrozen(channel)).toBe(true);
    expect(CHANNEL_KEY in channel).toBe(true);
    expect(channel.name).toBe('test');
  });

  it('returns pre-bound capable that creates capabilities in the channel', () => {
    const { capable, channel } = createChannel('test-cap', connectorOf(passthrough()));
    const cap = capable((x: number) => x * 2, 't/preBoundCap');
    expect(cap[CAPABILITY_TAG]).toBe(true);
    expect(cap(5)).toBe(10);
  });

  it('returns context (wrapped) for direct use', () => {
    let activeReg: ResolvedRegistry | undefined;
    const mockReg: ResolvedRegistry = { resolve: () => null };
    const { context } = createChannel('test-ctx', connectorOf({
      get: () => activeReg,
      run: <T>(reg: ResolvedRegistry | undefined, fn: () => T) => {
        activeReg = reg;
        try {
          return fn();
        } finally {
          activeReg = undefined;
        }
      },
    }));
    context.run(mockReg, () => {
      expect(activeReg).toBe(mockReg);
    });
  });

  it('context (get/run) follows a setChannelContext swap', () => {
    const store1 = { val: undefined as ResolvedRegistry | undefined };
    const store2 = { val: undefined as ResolvedRegistry | undefined };
    const makeCtx = (store: { val: ResolvedRegistry | undefined }): ScopeContext<ResolvedRegistry> => ({
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
    });
    const { context, channel } = createChannel('test-ctx-swap', connectorOf(makeCtx(store1)));
    setChannelContext(channel, makeCtx(store2));

    const mockReg: ResolvedRegistry = { resolve: () => null };
    context.run(mockReg, () => {
      expect(store2.val).toBe(mockReg); // writes go through to the swapped-in context
      expect(store1.val).toBeUndefined(); // not the orphaned original
      expect(context.get()).toBe(mockReg); // reads come from the swapped-in context too
    });
  });

  it('returns pre-bound snapshot that captures this channel\'s scope', () => {
    let activeReg: ResolvedRegistry | undefined;
    const mockReg: ResolvedRegistry = { resolve: () => null };
    const { snapshot, context } = createChannel('test-snap', connectorOf({
      get: () => activeReg,
      run: <T>(reg: ResolvedRegistry | undefined, fn: () => T) => {
        activeReg = reg;
        try {
          return fn();
        } finally {
          activeReg = undefined;
        }
      },
    }));
    let bound: (() => void) | undefined;
    let seen: ResolvedRegistry | undefined;
    context.run(mockReg, () => {
      bound = snapshot(() => {
        seen = activeReg;
      });
    });
    bound!();
    expect(seen).toBe(mockReg);
  });

  it('unique channel per call even with same name', () => {
    const { channel: g1 } = createChannel('same', connectorOf(noScope()));
    const { channel: g2 } = createChannel('same', connectorOf(noScope()));
    expect(g1).not.toBe(g2);
    expect(g1[CHANNEL_KEY]).not.toBe(g2[CHANNEL_KEY]);
  });

  it('capable supports view composition', () => {
    const { capable } = createChannel('view-test', connectorOf(passthrough()));
    const entry = capable(() => 'base', 't/viewEntry');
    const view = capable(entry, 't/viewComposed', { strategy: { extract: (v: () => string) => v, step: (_a: (() => string) | undefined) => (b: () => string) => b } });
    expect(view()).toBe('base');
  });
});
