import { describe, expectTypeOf, it, expect } from 'vitest';
import type { AnyFn } from '../util/types';
import type { Capability } from '../capability/types';
import type { RegistryLayers, CapabilityLayers } from '../registry/types';
import { CAPABILITY_ID } from '../capability/symbols';
import { createChannel } from '../channel/createChannel';
import { registry } from '../registry/registry';
import { foldBindings } from '../factory';
import { connectorOf } from './connectorOf';

const { capable } = createChannel('inspect-test', connectorOf({
  get: () => undefined,
  run: <T>(_: unknown, fn: () => T): T => fn(),
}));

describe('capable identity', () => {
  it('threads the assembled channelName:project/capability identity into the capability type', () => {
    const cap = capable((x: number) => x, 'proj/fxType');
    expectTypeOf(cap).toExtend<Capability<(x: number) => number, any, any, 'inspect-test:proj/fxType'>>();
  });

  it('stores the assembled identity at runtime under CAPABILITY_ID', () => {
    const cap = capable((x: number) => x, 'proj/fxStore');
    expect((cap as unknown as Record<symbol, unknown>)[CAPABILITY_ID]).toBe('inspect-test:proj/fxStore');
  });
});

// A (name, fn)-accumulating strategy, so layer() takes two args and
// LayerArgs<cap> = [string, AnyFn].
const dictStrategy = {
  step: (parent: Record<string, AnyFn> | undefined) =>
    (name: string, fn: AnyFn): Record<string, AnyFn> => ({ ...(parent ?? {}), [name]: fn }),
  extract: (dict: Record<string, AnyFn>) => (): Record<string, AnyFn> => dict,
};

describe('Registry manifest', () => {
  it('grows the manifest for every layered capability (identity makes the manifest total)', () => {
    const fx = capable((): Record<string, AnyFn> => ({}), 'proj/fxM', { strategy: dictStrategy });
    const sv = capable((n: number) => n, 'proj/svM');
    const reg = registry().layer(fx, 'a', (x: number) => x).layer(sv, (n: number) => n * 2);
    type M = RegistryLayers<typeof reg>;
    // Both capabilities are recorded — every capability carries an identity.
    expectTypeOf<M['length']>().toEqualTypeOf<2>();
    // fx's entry captured the literal name
    expectTypeOf<CapabilityLayers<M, typeof fx>['args'][0]>().toEqualTypeOf<'a'>();
  });

  it('CapabilityLayers selects a capability and excludes a same-shaped one with a different identity', () => {
    const a = capable((): Record<string, AnyFn> => ({}), 'proj/a', { strategy: dictStrategy });
    const b = capable((): Record<string, AnyFn> => ({}), 'proj/b', { strategy: dictStrategy });
    const fn = (x: number) => x;
    const reg = registry().layer(a, 'x', fn).layer(b, 'y', fn);
    type M = RegistryLayers<typeof reg>;
    // only a's entry — the identity literal discriminates a from same-shaped b
    expectTypeOf<CapabilityLayers<M, typeof a>['args'][0]>().toEqualTypeOf<'x'>();
  });
});

describe('foldBindings (build-plugin path) parity', () => {
  it('folds a collapsed binding value identically to the runtime path, via the public factory export', () => {
    const dflt = { step: (p: string | undefined) => (c: string) => (p ?? '') + c, extract: (v: string, b: () => string) => () => `${b()}|${v}` };
    const cap = capable(() => 'base', 'proj/parity', { strategy: dflt as any });

    const resolved = foldBindings(cap as any, [{
      argsList: [['x'], ['y']],
      augments: [],
    }]);
    expect((resolved as any)()).toBe('base|xy');
  });
});
