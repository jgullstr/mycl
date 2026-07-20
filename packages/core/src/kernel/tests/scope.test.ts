import { describe, expect, it } from 'vitest';
import { capable } from './defaultContext';
import { registry } from '@mycl/core';
import { merge } from '@mycl/core/factory';
import { scope } from './scope';
import { foldBindings } from '@mycl/core/factory';

describe('scope', () => {
  it('scope(fn) — base only: capability falls back to base', () => {
    const cap = capable((x: number) => x * 2, 't/baseOnly');
    const fn = (x: number) => cap(x);
    const bound = scope(fn);
    expect(bound(5)).toBe(10);
  });

  it('scope(fn) — a strategy with `seed` still falls back to base when no layers contribute', () => {
    // `seed` is only a fold seed, not a trigger: with no layers, the capability falls
    // back to its base function even when `seed` is declared.
    const cap = capable((x: number) => x + 1, 't/seedFallback', {
      strategy: {
        seed: 100,
        step: (parent: number | undefined) => (v: number) => (parent ?? 0) + v,
        extract: (value: number) => (x: number) => x + value,
      },
    });
    const bound = scope((x: number) => cap(x));
    // No layers → falls back to base: x + 1
    expect(bound(5)).toBe(6);
  });

  it('scope(fn, reg) — capability dispatches through registry', () => {
    const cap = capable((x: number) => x * 2, 't/scopeWithReg');
    const reg = registry().layer(cap, (x: number) => x * 100);
    const fn = (x: number) => cap(x);
    const bound = scope(fn, reg);
    expect(bound(5)).toBe(500);
  });

  it('scope(fn, resolvedReg) — accepts a ResolvedRegistry directly', () => {
    const cap = capable((x: number) => x * 2, 't/scopeResolved');
    const reg = registry().layer(cap, (x: number) => x * 100);
    const fn = (x: number) => cap(x);
    const resolved = merge(reg);
    const bound = scope(fn, resolved);
    expect(bound(5)).toBe(500);
  });

  it('scope returns a different function object', () => {
    const fn = (x: number) => x;
    expect(scope(fn)).not.toBe(fn);
    expect(scope(fn, registry())).not.toBe(fn);
  });

  it('preserves this binding', () => {
    const fn = function (this: { factor: number }, x: number) {
      return this.factor * x;
    };
    const bound = scope(fn, registry());
    expect(bound.call({ factor: 6 }, 7)).toBe(42);
  });

  it('capability outside scope throws without scope(fn)', () => {
    const cap = capable((x: number) => x * 2, 't/outsideScope');
    expect(() => cap(5)).toThrow('called outside any registry scope');
  });
});

describe('scope with a precomputed ResolvedRegistry', () => {
  // A precomputed ResolvedRegistry per the public contract: an eager WeakMap fold via
  // foldBindings, behind a plain frozen { resolve } object (no token, no sym rendezvous).
  it('dispatches via the folded WeakMap entry when the capability is present', () => {
    const cap = capable((x: number) => x * 2, 't/lookupDispatch');
    const handler = (x: number) => x * 100;
    const m = new WeakMap();
    m.set(cap, foldBindings(cap, [{ argsList: [[handler]], augments: [] }]));
    const reg = Object.freeze({ resolve: (c: any) => m.get(c) ?? null });

    const fn = (x: number) => cap(x);
    expect(scope(fn, reg)(5)).toBe(500);
  });

  it('falls back to capability base when the WeakMap has no entry for the capability', () => {
    const cap = capable((x: number) => x * 2, 't/lookupFallback');
    const other = capable((x: number) => x, 't/lookupFallbackOther');
    const m = new WeakMap();
    m.set(other, foldBindings(other, [{ argsList: [[(x: number) => x * 100]], augments: [] }]));
    const reg = Object.freeze({ resolve: (c: any) => m.get(c) ?? null });

    const fn = (x: number) => cap(x);
    expect(scope(fn, reg)(5)).toBe(10); // falls back to base: x * 2
  });
});
