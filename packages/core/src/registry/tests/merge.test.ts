import { describe, expect, it } from 'vitest';
import { merge } from '../merge';
import { makeResolvedRegistry, getResolvedSym } from '../resolvedRegistry';
import { registry } from '../registry';
import { createChannel } from '../../channel/createChannel';
import { connectorOf } from '../../tests/connectorOf';

const { capable } = createChannel('resolve-test', connectorOf({
  get: () => undefined,
  run: <T>(_: unknown, fn: () => T): T => fn(),
}));

describe('layer', () => {
  it('returns null for a capability with no binding', () => {
    const cap = capable(() => 'default', 't/noBinding');
    const resolved = merge(registry());
    expect(resolved.resolve(cap)).toBeNull();
  });

  it('returns the bound function for a registered capability', () => {
    const cap = capable(() => 'default', 't/boundFn');
    const reg = registry().layer(cap, () => 'bound');
    const resolved = merge(reg);
    expect(resolved.resolve(cap)?.()).toBe('bound');
  });

  it('later registry wins (last-wins default)', () => {
    const cap = capable(() => 'default', 't/laterWins');
    const r1 = registry().layer(cap, () => 'first');
    const r2 = registry().layer(cap, () => 'second');
    const resolved = merge(r1, r2);
    expect(resolved.resolve(cap)?.()).toBe('second');
  });

  it('augments are applied in order', () => {
    const cap = capable((): string => 'base', 't/augmentsInOrder');
    const reg = registry()
      .layer(cap, () => 'value')
      .augment(cap, (next) => () => `${next()} + aug`);
    const resolved = merge(reg);
    expect(resolved.resolve(cap)?.()).toBe('value + aug');
  });

  it('empty registries array returns null for all capabilities', () => {
    const cap = capable(() => 'default', 't/emptyRegistries');
    const resolved = merge();
    expect(resolved.resolve(cap)).toBeNull();
  });

  it('variadic set passes extra args through step', () => {
    type Dict = Record<string, string>;
    const cap = capable<() => Dict, Dict, [string, string]>(() => ({} as Dict), 't/variadicSet', {
      strategy: {
        step: (parent: Dict | undefined) => (key: string, value: string) => ({ ...(parent ?? {}), [key]: value }),
        extract: (record: Dict) => () => record,
      },
    });

    const reg = registry()
      .layer(cap, 'greeting', 'hello')
      .layer(cap, 'subject', 'world');

    const resolved = merge(reg);
    expect(resolved.resolve(cap)?.()).toEqual({ greeting: 'hello', subject: 'world' });
  });
});

describe('resolved registry sym identity', () => {
  it('same single registry always gets the same sym', () => {
    const r1 = registry();
    expect(getResolvedSym(merge(r1)))
      .toBe(getResolvedSym(merge(r1)));
  });

  it('different registry instances get different syms', () => {
    const r1 = registry();
    const r2 = registry();
    expect(getResolvedSym(merge(r1)))
      .not.toBe(getResolvedSym(merge(r2)));
  });

  it('[r1, r2] differs from [r1], [r2], and [r2, r1]', () => {
    const r1 = registry();
    const r2 = registry();
    const s1 = getResolvedSym(merge(r1));
    const s2 = getResolvedSym(merge(r2));
    const s12 = getResolvedSym(merge(r1, r2));
    const s21 = getResolvedSym(merge(r2, r1));
    expect(s12).not.toBe(s1);
    expect(s12).not.toBe(s2);
    expect(s12).not.toBe(s21);
  });

  it('empty registry array always gets the same sym', () => {
    expect(getResolvedSym(merge()))
      .toBe(getResolvedSym(merge()));
  });

  it('makeResolvedRegistry registers the given sym', () => {
    const sym = Symbol('test');
    const reg = makeResolvedRegistry(() => null, sym);
    expect(getResolvedSym(reg)).toBe(sym);
  });
});

describe('resolved registry object identity', () => {
  it('same registry sequence returns the same ResolvedRegistry object', () => {
    const r1 = registry();
    const r2 = registry();
    const resolved1 = merge(r1, r2);
    const resolved2 = merge(r1, r2);
    expect(resolved1).toBe(resolved2);
    expect(getResolvedSym(resolved1)).toBe(getResolvedSym(resolved2));
  });

  it('empty registry array returns the same ResolvedRegistry object', () => {
    const resolved1 = merge();
    const resolved2 = merge();
    expect(resolved1).toBe(resolved2);
  });
});

describe('shared-base composition dedup', () => {
  it('shared layer contribution folds once, not once per derived registry', () => {
    type Str = string | undefined;
    const cap = capable<() => Str, Str, [string]>(() => undefined, 't/sharedBaseDedup', {
      strategy: {
        step: (parent: Str) => (s: string) => parent !== undefined ? `${parent} ${s}` : s,
        extract: (s: Str) => () => s,
      },
    });
    const base = registry().layer(cap, 'base');
    const featureA = base.layer(cap, 'a');
    const featureB = base.layer(cap, 'b');
    const resolved = merge(featureA, featureB);
    // 'base' is shared — folds once. 'a' and 'b' are distinct — both fold.
    expect(resolved.resolve(cap)?.()).toBe('base a b');
  });

  it('shared augment fires once when both branches merge', () => {
    const cap = capable((): number => 0, 't/sharedAugmentOnce');
    let fires = 0;
    const counting: import('../../util/types').AugmentWrapper<() => number> = (next) => () => {
      fires++;
      return next();
    };
    const base = registry().augment(cap, counting);
    const featureA = base.layer(cap, () => 1);
    const featureB = base.layer(cap, () => 2);
    fires = 0;
    merge(featureA, featureB).resolve(cap)?.();
    expect(fires).toBe(1);
  });

  it('intentional same-wrapper double-augment fires twice', () => {
    const cap = capable((): number => 0, 't/doubleAugmentTwice');
    let fires = 0;
    const counting: import('../../util/types').AugmentWrapper<() => number> = (next) => () => {
      fires++;
      return next();
    };
    const reg = registry().augment(cap, counting).augment(cap, counting);
    fires = 0;
    merge(reg).resolve(cap)?.();
    expect(fires).toBe(2);
  });
});

describe('input array isolation', () => {
  it('mutating the input array after resolution does not change dispatch or poison the cache', () => {
    const cap = capable(() => 'base', 't/inputArrayIsolation');
    const regA = registry().layer(cap, () => 'A');
    const regB = registry().layer(cap, () => 'B');

    const arr = [regA];
    const resolved = merge(...arr);
    arr.push(regB); // caller mutates after resolution

    expect(resolved.resolve(cap)!()).toBe('A');
    // the cached resolver for the [regA] sequence is untouched
    expect(merge(regA).resolve(cap)!()).toBe('A');
  });
});
