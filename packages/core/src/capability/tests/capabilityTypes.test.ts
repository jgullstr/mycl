import { describe, expectTypeOf, it } from 'vitest';
import type { Capability } from '../types';
import type { Registry } from '../../registry/types';
import { CAPABILITY_BASE, CAPABILITY_TAG } from '../symbols';
import { createChannel } from '../../channel/createChannel';
import { registry } from '../../registry/registry';
import { connectorOf } from '../../tests/connectorOf';
const { capable, snapshot } = createChannel('cap-types', connectorOf({
  get: () => undefined,
  run: <T>(_: unknown, fn: () => T): T => fn(),
}));

// ─────────────────────────────────────────────────────────────────────────
// 1. Capability<T,V,Args> instantiated at concrete types — call signature & return
// ─────────────────────────────────────────────────────────────────────────

describe('Capability<T,V,Args> at concrete types', () => {
  type Fn = (name: string, times: number) => string;

  it('exposes T’s exact call signature and return', () => {
    type C = Capability<Fn, string, [string]>;
    expectTypeOf<C>().toExtend<Fn>();
    expectTypeOf<C extends Fn ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<Parameters<C>>().toEqualTypeOf<[name: string, times: number]>();
    expectTypeOf<ReturnType<C>>().toEqualTypeOf<string>();
  });

  it('carries the runtime brand slots at their declared types', () => {
    type C = Capability<Fn, string, [string]>;
    expectTypeOf<C[typeof CAPABILITY_TAG]>().toEqualTypeOf<true>();
    expectTypeOf<C[typeof CAPABILITY_BASE]>().toEqualTypeOf<Fn>();
  });

  it('value contract is nominal — distinct V/Args are NOT interchangeable', () => {
    // Branding makes V/Args participate; the two are now distinct types.
    expectTypeOf<Capability<Fn, string, [string]>>().not.toEqualTypeOf<Capability<Fn, number, [number]>>();
  });

  it('rejects assigning a string-contract capability where a number-contract one is required', () => {
    const wantsNumber = (_c: Capability<Fn, number, [number]>): void => {};
    const stringCap = null as unknown as Capability<Fn, string, [string]>;
    // @ts-expect-error — different value contracts are not assignable
    wantsNumber(stringCap);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. capable() inference matches intent (signature in == signature out)
// ─────────────────────────────────────────────────────────────────────────

describe('capable() inference', () => {
  it('preserves the base call signature on the returned capability', () => {
    const greet = capable((name: string) => name.length, 't/preservesSignature');
    expectTypeOf(greet).toExtend<(name: string) => number>();
    expectTypeOf(greet).parameters.toEqualTypeOf<[name: string]>();
    expectTypeOf(greet).returns.toEqualTypeOf<number>();
    expectTypeOf(greet[CAPABILITY_TAG]).toEqualTypeOf<true>();
  });

  it('layer infers a same-signature replacement fn for a no-strategy capability', () => {
    const greet = capable((name: string) => name.length, 't/layerNoStrategy');
    const reg = registry();
    // V defaults to T, so Args = [T] — the layer value must be a replacement function.
    // Note: toBeCallableWith uses unknown-widened parameter types which the invariant brand
    // rejects; use a direct call to verify type compatibility instead.
    expectTypeOf(reg.layer(greet, (name: string) => 0)).toEqualTypeOf<Registry>();
  });

  it('layer infers the value type for a strategy capability', () => {
    const cls = capable(() => 'btn', 't/layerStrategy', {
      strategy: { extract: (c: string) => () => c, step: (a) => (b: string) => `${a ?? ''} ${b}` },
    });
    const reg = registry();
    // Same reasoning: direct call instead of toBeCallableWith.
    expectTypeOf(reg.layer(cls, 'bg-blue-500')).toEqualTypeOf<Registry>();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. snapshot() overloads vs. what the implementation can actually produce
//
//   signature: snapshot<T extends AnyFn>(fn: T): Snapshotted<T>  → call sig, this, params, return; own props dropped
// ─────────────────────────────────────────────────────────────────────────

describe('snapshot() overload soundness', () => {
  it('plain function: declared return is exactly what the impl produces', () => {
    const fn = (x: number) => x + 1;
    expectTypeOf(snapshot(fn)).toEqualTypeOf<(x: number) => number>();
  });

  it('capability input returns the BASE fn type — brand intentionally dropped (sound)', () => {
    const greet = capable((name: string) => name.length, 't/snapshotBase');
    expectTypeOf(snapshot(greet)).toEqualTypeOf<(name: string) => number>();
    // @ts-expect-error — result is a plain fn, not branded; the wrapper drops the brand.
    snapshot(greet)[CAPABILITY_TAG];
  });

  it('hybrid fn — own properties are NOT promised (sound)', () => {
    const counter = Object.assign((n: number) => n, { calls: 0 });
    // Snapshotted keeps the call signature but drops own-properties.
    expectTypeOf(snapshot(counter)).toExtend<(n: number) => number>();
    // @ts-expect-error — `.calls` is not on the snapshotted result (the wrapper has no own props)
    snapshot(counter).calls;
  });

  it('typed-this fn — the this contract is expressed, not asserted (sound)', () => {
    type WithThis = (this: { id: string }, n: number) => number;
    const fn = function (this: { id: string }, n: number) {
      return n + this.id.length;
    } as WithThis;
    expectTypeOf(snapshot(fn)).parameters.toEqualTypeOf<[n: number]>();
    expectTypeOf(snapshot(fn)).returns.toEqualTypeOf<number>();
    expectTypeOf<ThisParameterType<typeof fn>>().toEqualTypeOf<{ id: string }>();
  });
});
