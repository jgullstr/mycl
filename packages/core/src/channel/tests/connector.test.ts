import { describe, expect, expectTypeOf, it } from 'vitest';
import { createChannel } from '../createChannel';
import type { ChannelSurface } from '../types';
import { setChannelContext } from '../slot';
import { stackContext } from '../../context';
import { registry } from '../../registry/registry';
import { merge } from '../../registry/merge';
import type { ResolvedRegistry } from '../../registry/types';

/**
 * The connector contract: createChannel(name, connector) hands the name to the
 * connector (the G-carrier), mints the channel over the connector's fresh context,
 * and returns exactly what the connector's build makes of the base kernel.
 */

/** A reusable identity connector: fresh stack context, base kernel passthrough. */
const idConnector = <G extends string>(_name: G) => ({
  context: stackContext(),
  build: (base: ChannelSurface<G>) => base,
});

describe('createChannel(name, connector)', () => {
  it('hands the name to the connector and returns exactly what build returns', () => {
    const calls: string[] = [];
    const ui = createChannel('ui', (name: 'ui') => {
      calls.push(name);
      return {
        context: stackContext(),
        build: (base: ChannelSurface<'ui'>) => ({ tag: base.channel.name }),
      };
    });
    expect(calls).toEqual(['ui']);
    expect(ui.tag).toBe('ui');
    // The kernel is the connector's curated surface, nothing more.
    expect('capable' in ui).toBe(false);
    expectTypeOf(ui).toEqualTypeOf<{ tag: 'ui' }>();
  });

  it('threads the name literal through a generic connector with no annotations', () => {
    const k = createChannel('drv', idConnector);
    expectTypeOf(k.channel.name).toEqualTypeOf<'drv'>();
    expectTypeOf(k).toEqualTypeOf<ChannelSurface<'drv'>>();
  });

  it('mints a fresh context per channel: a scope on one never masks the other', () => {
    const a = createChannel('iso-a', idConnector);
    const b = createChannel('iso-b', idConnector);
    const capA = a.capable((x: number) => x, 't/iso');
    const withA = merge(registry().layer(capA, (x: number) => x * 2));
    // B's scope sits on top of A's: if the contexts were shared, capA would
    // resolve against B's (empty) registry and fall back to base.
    const out = a.context.run(withA, () => b.context.run(merge(), () => capA(3)));
    expect(out).toBe(6);
  });

  it('base.context is the live facade: it follows setChannelContext swaps', () => {
    const k = createChannel('swap-drv', idConnector);
    const cap = k.capable((x: number) => x, 't/swap');
    const reg = merge(registry().layer(cap, (x: number) => x + 40));

    let store: ResolvedRegistry | undefined;
    setChannelContext(k.channel, {
      get: () => store,
      run: <T,>(v: ResolvedRegistry | undefined, fn: () => T): T => {
        const prev = store;
        store = v;
        try {
          return fn();
        } finally {
          store = prev;
        }
      },
    });

    expect(k.context.run(reg, () => cap(2))).toBe(42);
  });
});
