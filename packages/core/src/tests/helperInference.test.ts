import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AnyFn, AugmentWrapper } from '../util/types';
import { createChannel } from '../channel/createChannel';
import { after, before, handleError, pipe } from '../util/helpers';
import { registry } from '../registry/registry';
import { connectorOf } from './connectorOf';

// Inference regression suite — pins the contextual-inference mechanism the
// two-argument `augment(cap, wrapper)` form depends on: TS instantiates a
// generic helper call from the contextual type of the second argument
// position. Each case asserts concrete parameter types, not just absence of
// errors. Verified TS floor: 4.7; the repo pins ^5.4 — if a future TS version
// regresses this, these tests are the tripwire.

const { capable } = createChannel('helper-inference-test', connectorOf({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() }));

describe('augment inference', () => {
  it('raw inline wrapper: next and args infer from the capability', () => {
    const fetchCount = capable((id: string) => id.length, 't/rawInline');
    registry().augment(fetchCount, (next) => {
      expectTypeOf(next).toEqualTypeOf<(id: string) => number>();
      return (id) => {
        expectTypeOf(id).toEqualTypeOf<string>();
        return next(id) + 1;
      };
    });
  });

  it('flat helper calls infer result and argument types', () => {
    const fetchCount = capable((id: string) => id.length, 't/flatHelpers');
    registry()
      .augment(fetchCount, before((id) => {
        expectTypeOf(id).toEqualTypeOf<string>();
      }))
      .augment(fetchCount, after((result, id) => {
        expectTypeOf(result).toEqualTypeOf<number>();
        expectTypeOf(id).toEqualTypeOf<string>();
      }))
      .augment(fetchCount, pipe((r) => {
        expectTypeOf(r).toEqualTypeOf<number>();
        return r + 1;
      }))
      .augment(fetchCount, handleError((error, id) => {
        expectTypeOf(error).toEqualTypeOf<unknown>();
        expectTypeOf(id).toEqualTypeOf<string>();
        return -1;
      }));
  });

  it('nested combinator: helpers under a generic wrapper combinator still infer', () => {
    const stack = <T extends AnyFn>(outer: AugmentWrapper<T>, inner: AugmentWrapper<T>): AugmentWrapper<T> =>
      (next) => outer(inner(next));
    const fetchCount = capable((id: string) => id.length, 't/nestedCombinator');
    const reg = registry()
      .layer(fetchCount, (id: string) => id.length)
      .augment(fetchCount, stack(
        pipe((r) => {
          expectTypeOf(r).toEqualTypeOf<number>();
          return r * 10;
        }),
        after((result, id) => {
          expectTypeOf(result).toEqualTypeOf<number>();
          expectTypeOf(id).toEqualTypeOf<string>();
        }),
      ));
    expect(reg.has(fetchCount)).toBe(true);
  });

  it('reusable transform: nullary factory infers at the augment site', () => {
    // A bare `const withFallback = handleError(() => null)` would freeze T at
    // declaration — reusables are nullary factories instead.
    const withFallback = <T extends (...args: any[]) => number | null>(): AugmentWrapper<T> =>
      handleError<T>(() => null as Awaited<ReturnType<T>>);
    const fetchUser = capable((id: string): number | null => id.length, 't/reusableFallback');
    const reg = registry().augment(fetchUser, withFallback());
    expect(reg.has(fetchUser)).toBe(true);
  });

  it('capability-agnostic wrapper: generic factory pattern (erased wrappers do not assign)', () => {
    // `AugmentWrapper<AnyFn>` does not assign to a concrete `AugmentWrapper<T>`
    // (the return-type direction fails) — bless the generic factory instead.
    const timed = <T extends AnyFn>(): AugmentWrapper<T> =>
      (next) => ((...args: Parameters<T>) => next(...args) as ReturnType<T>) as T;
    const fetchCount = capable((id: string) => id.length, 't/capabilityAgnostic');
    registry().augment(fetchCount, timed());

    const erased: AugmentWrapper = (next) => next;
    // @ts-expect-error — AugmentWrapper<AnyFn> is not AugmentWrapper<(id: string) => number>
    const concrete: AugmentWrapper<(id: string) => number> = erased;
    void concrete;

    // At the augment site itself an erased wrapper IS accepted — T infers
    // from both arguments and widens to AnyFn. Acceptable: an AnyFn wrapper
    // is universally applicable at runtime; pinned here so a change is loud.
    registry().augment(fetchCount, erased);
  });
});

describe('augment rejections', () => {
  it('rejects a wrapper for an incompatible signature', () => {
    const greet = capable((name: string) => name.length, 't/rejectIncompatible');
    const wrongWrapper: AugmentWrapper<(flag: boolean) => boolean> = (next) => next;
    // @ts-expect-error — wrapper is for a different signature
    registry().augment(greet, wrongWrapper);
  });

  it('rejects a handler with wrongly-typed parameters inside the helper call', () => {
    const greet = capable((name: string) => name.length, 't/rejectWrongParams');
    // @ts-expect-error — result is number, not string
    registry().augment(greet, after((result: string) => {
      void result;
    }));
  });
});

describe('augment acceptance (by design)', () => {
  it('two capabilities with identical signatures share wrappers', () => {
    // Wrappers are shape-level: the V brand lives on capabilities, not on
    // AugmentWrapper. Sharing across same-signature capabilities is intended.
    const a = capable((x: number) => x, 't/shareA');
    const b = capable((x: number) => x, 't/shareB');
    const w: AugmentWrapper<(x: number) => number> = (next) => (x) => next(x) + 1;
    const reg = registry().augment(a, w).augment(b, w);
    expect(reg.has(a)).toBe(true);
    expect(reg.has(b)).toBe(true);
  });
});
