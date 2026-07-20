import { describe, it, expectTypeOf } from 'vitest';
import type { CapabilityId, AccumulatedValue, LayerArgs } from '../../capability/types';
import type { ProvidedIds } from '../types';
import { createChannel } from '../../channel/createChannel';
import { registry } from '../registry';
import { connectorOf } from '../../tests/connectorOf';

const { capable } = createChannel('pb', connectorOf({
  get: () => undefined,
  run: <T>(_: unknown, fn: () => T): T => fn(),
}));

describe('CapabilityId', () => {
  it('extracts the assembled identity literal from a capability type', () => {
    const cap = capable((x: number) => x, 'app/thing');
    expectTypeOf<CapabilityId<typeof cap>>().toEqualTypeOf<'pb:app/thing'>();
  });
});

describe('ProvidedIds', () => {
  it('unions the identities a registry layers', () => {
    const a = capable((): number => 1, 'app/a');
    const b = capable((): number => 2, 'app/b');
    const reg = registry().layer(a, () => 1).layer(b, () => 2);
    expectTypeOf<ProvidedIds<typeof reg>>().toEqualTypeOf<'pb:app/a' | 'pb:app/b'>();
  });

  it('is never for an empty registry', () => {
    const reg = registry();
    expectTypeOf<ProvidedIds<typeof reg>>().toEqualTypeOf<never>();
  });
});

describe('AccumulatedValue / LayerArgs', () => {
  it('reads T back for a plain capability', () => {
    const cap = capable((x: number) => x, 'app/plain');
    expectTypeOf<AccumulatedValue<typeof cap>>().toEqualTypeOf<(x: number) => number>();
    expectTypeOf<LayerArgs<typeof cap>>().toEqualTypeOf<[(x: number) => number]>();
  });

  it('reads the accumulated value and layer args for a strategy capability', () => {
    const cls = capable(() => 'btn', 'app/clsReaders', {
      strategy: {
        step: (parent: string | undefined) => (b: string) => `${parent ?? ''} ${b}`,
        extract: (value) => () => value,
      },
    });
    expectTypeOf<AccumulatedValue<typeof cls>>().toEqualTypeOf<string>();
    expectTypeOf<LayerArgs<typeof cls>>().toEqualTypeOf<[string]>();
  });

  it('distributes over a union of capabilities', () => {
    const a = capable((x: number) => x, 'app/unionA');
    const b = capable(() => 'btn', 'app/unionB', {
      strategy: {
        step: (parent: string | undefined) => (s: string) => `${parent ?? ''} ${s}`,
        extract: (value) => () => value,
      },
    });
    type Both = typeof a | typeof b;
    expectTypeOf<AccumulatedValue<Both>>().toEqualTypeOf<((x: number) => number) | string>();
    expectTypeOf<LayerArgs<Both>>().toEqualTypeOf<[(x: number) => number] | [string]>();
  });
});
