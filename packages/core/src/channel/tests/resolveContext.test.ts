import { describe, expect, it } from 'vitest';
import { createChannel } from '../createChannel';
import { stackContext } from '../../context';
import { resolveContext, setChannelContext } from '../slot';
import { merge } from '../../registry/merge';
import type { ResolvedRegistry } from '../../registry/types';
import { connectorOf } from '../../tests/connectorOf';

describe('resolveContext', () => {
  it('returns a facade routing get/run to the channel context', () => {
    const { channel } = createChannel('test.ctxFor', connectorOf(stackContext()));
    const ctx = resolveContext(channel);
    const resolved = merge();

    expect(ctx.get()).toBeUndefined();
    const seen = ctx.run(resolved, () => ctx.get());
    expect(seen).toBe(resolved);
    expect(ctx.get()).toBeUndefined();
  });

  it('follows a setChannelContext swap made after the facade was captured', () => {
    const { channel } = createChannel('test.ctxForSwap', connectorOf(stackContext()));
    const ctx = resolveContext(channel);
    const resolved = merge();

    let store: ResolvedRegistry | undefined;
    setChannelContext(channel, {
      get: () => store,
      run: (reg, fn) => {
        const prev = store;
        store = reg;
        try {
          return fn();
        } finally {
          store = prev;
        }
      },
    });

    const seen = ctx.run(resolved, () => ctx.get());
    expect(seen).toBe(resolved);
  });

  it('throws on an invalid channel', () => {
    expect(() => resolveContext({} as never)).toThrow();
  });
});
