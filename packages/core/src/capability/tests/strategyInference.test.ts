import { describe, expectTypeOf, it } from 'vitest';
import type { LayerArgs, AccumulatedValue } from '../types';
import { createChannel } from '../../channel/createChannel';
import { connectorOf } from '../../tests/connectorOf';

// Pins the V-inference contract for strategy capabilities. A fully
// unannotated strategy gives V no non-deferred inference source (step
// and extract are context-sensitive functions, whose returns contribute
// candidates too late), so V falls back to its default, T, and the strategy
// properties error against the wrong type. Any one of three annotations
// rescues it; all three are pinned here, plus the bare form's failure as a
// tripwire for TypeScript behaviour changes.

const { capable } = createChannel('strat-inference', connectorOf({
  get: () => undefined,
  run: <T>(_: unknown, fn: () => T): T => fn(),
}));

describe('strategy V inference', () => {
  it('infers V from an annotated extract value param', () => {
    const cls = capable(() => 'btn', 't/assembleAnnotated', {
      strategy: {
        step: (parent) => (b: string) => `${parent ?? ''} ${b}`,
        extract: (value: string) => () => value,
      },
    });
    expectTypeOf<AccumulatedValue<typeof cls>>().toEqualTypeOf<string>();
    expectTypeOf<LayerArgs<typeof cls>>().toEqualTypeOf<[string]>();
  });

  it('infers V from an annotated step acc param', () => {
    const cls = capable(() => 'btn', 't/parentAnnotated', {
      strategy: {
        step: (parent: string | undefined) => (b: string) => `${parent ?? ''} ${b}`,
        extract: (value) => () => value,
      },
    });
    expectTypeOf<AccumulatedValue<typeof cls>>().toEqualTypeOf<string>();
  });

  it('infers V from seed', () => {
    const cls = capable(() => 'btn', 't/seeded', {
      strategy: {
        seed: '',
        step: (parent) => (b: string) => `${parent ?? ''} ${b}`,
        extract: (value) => () => value,
      },
    });
    expectTypeOf<AccumulatedValue<typeof cls>>().toEqualTypeOf<string>();
  });

  it('tripwire: with no annotation V falls back to T and the strategy errors', () => {
    void (() => capable(() => 'btn', 't/unannotated', {
      strategy: {
        // @ts-expect-error V defaulted to T, so the string return mismatches
        step: (parent) => (b: string) => `${parent ?? ''} ${b}`,
        // @ts-expect-error value is typed as T (a function), not string
        extract: (value) => () => value,
      },
    }));
  });
});
