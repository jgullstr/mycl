import { describe, expect, expectTypeOf, it } from 'vitest';
import { capable, snapshot } from './defaultContext';
import { scope } from './scope';
import { isCapability, registry } from '@mycl/core';
import type { Registry } from '@mycl/core';
import { merge } from '@mycl/core/factory';
import defaultContext from './defaultContext';

const noop = () => {};

/** Run `fn` within a registry scope. */
const withRegistry = <T>(reg: Registry, fn: () => T): T => {
  return defaultContext.run(merge(reg), fn);
};

describe('capable', () => {
  describe('creation', () => {
    it('returns a callable function', () => {
      const cap = capable(() => 42, 't/returnsCallable');
      expect(typeof cap).toBe('function');
    });

    it('is frozen', () => {
      const cap = capable(() => {}, 't/isFrozen');
      expect(Object.isFrozen(cap)).toBe(true);
    });

    it('brands the callable as a capability and falls back to the base', () => {
      // Branding via the public guard; base storage is core's own suite's
      // concern (asserted there against the internal symbols).
      const baseFn = () => 'base';
      const cap = capable(baseFn, 't/tagsAndStoresBase');
      expect(isCapability(cap)).toBe(true);
      expect(scope(() => cap())()).toBe('base');
    });
  });

  describe('dispatch', () => {
    it('throws when called outside any registry scope', () => {
      const cap = capable(() => 'base', 't/outsideScope');
      expect(() => cap()).toThrow('called outside any registry scope');
    });

    it('resolves from the active registry', () => {
      const cap = capable(() => 'base', 't/resolvesFromActive');
      const reg = registry().layer(cap, () => 'override');

      const result = withRegistry(reg, () => cap());
      expect(result).toBe('override');
    });

    it('falls back to base when registry has no override', () => {
      const cap = capable(() => 'base', 't/fallbackToBase');
      const other = capable(noop, 't/fallbackOther');
      const reg = registry().layer(other, noop);

      const result = withRegistry(reg, () => cap());
      expect(result).toBe('base');
    });

    it('resolves the innermost registry in nested scopes', () => {
      const cap = capable(() => 'base', 't/innermostNested');
      const outer = registry().layer(cap, () => 'outer');
      const inner = registry().layer(cap, () => 'inner');

      const result = withRegistry(outer, () => withRegistry(inner, () => cap()));
      expect(result).toBe('inner');
    });

    it('restores the previous registry after scope exits', () => {
      const cap = capable(() => 'base', 't/restoresPrevious');
      const outer = registry().layer(cap, () => 'outer');
      const inner = registry().layer(cap, () => 'inner');

      const result = withRegistry(outer, () => {
        withRegistry(inner, () => cap());
        return cap();
      });
      expect(result).toBe('outer');
    });

    it('passes arguments through to the implementation', () => {
      const cap = capable((a: number, b: number) => a + b, 't/passesArgs');
      const reg = registry().layer(cap, (a: number, b: number) => a * b);

      // default: args forwarded to base
      expect(withRegistry(registry(), () => cap(2, 3))).toBe(5);
      // override: args forwarded to registered impl
      expect(withRegistry(reg, () => cap(2, 3))).toBe(6);
    });
  });
});

describe('scope/snapshot signature preservation', () => {
  it('scope preserves the function signature', () => {
    const fn = (a: string, b: number) => `${a}${b}`;
    expectTypeOf(scope(fn)).parameters.toEqualTypeOf<[a: string, b: number]>();
    expectTypeOf(scope(fn)).returns.toEqualTypeOf<string>();
  });

  it('snapshot preserves params and return, drops the brand', () => {
    const greet = capable((name: string) => name.length, 't/snapshotGreet');
    expectTypeOf(snapshot(greet)).parameters.toEqualTypeOf<[name: string]>();
    expectTypeOf(snapshot(greet)).returns.toEqualTypeOf<number>();
  });
});
