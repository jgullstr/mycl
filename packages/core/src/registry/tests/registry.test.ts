import { describe, expect, it } from 'vitest';
import { registry } from '../registry';
import { merge } from '../merge';
import { createChannel } from '../../channel/createChannel';
import { connectorOf } from '../../tests/connectorOf';

const { capable } = createChannel('registry-test', connectorOf({ get: () => undefined, run: <T>(_: any, fn: () => T): T => fn() }));

describe('registry', () => {
  it('creates an empty registry', () => {
    const reg = registry();
    expect(reg).toBeDefined();
    expect(reg.has(capable(() => 0, 't/emptyRegistry'))).toBe(false);
  });

  it('layer returns a new registry (original unchanged)', () => {
    const cap = capable((x: number) => x, 't/layerNewRegistry');
    const r1 = registry();
    const r2 = r1.layer(cap, (x: number) => x * 2);
    expect(r1.has(cap)).toBe(false);
    expect(r2.has(cap)).toBe(true);
  });

  it('chained layer is immutable', () => {
    const cap = capable((x: number) => x, 't/chainedLayer');
    const r1 = registry();
    const r2 = r1.layer(cap, (x: number) => x * 2);
    const r3 = r2.layer(cap, (x: number) => x * 3);
    expect(r2).not.toBe(r3);
    expect(r2.bindings().get(cap)?.argsList?.[0]?.[0]).toEqual(expect.any(Function));
  });

  it('augment returns a new registry', () => {
    const cap = capable((x: number) => x, 't/augmentNewRegistry');
    const r1 = registry();
    const r2 = r1.augment(cap, (next) => (x: number) => next(x) + 1);
    expect(r1).not.toBe(r2);
    expect(r1.bindings().get(cap)).toBeUndefined();
    expect(r2.bindings().get(cap)?.augments).toHaveLength(1);
  });

  it('has: true for value', () => {
    const cap = capable((x: number) => x, 't/hasTrueValue');
    expect(registry().layer(cap, (x: number) => x).has(cap)).toBe(true);
  });

  it('has: true for augment only', () => {
    const cap = capable((x: number) => x, 't/hasTrueAugment');
    expect(registry().augment(cap, (next) => next).has(cap)).toBe(true);
  });

  it('has: false for absent capability', () => {
    const cap = capable((x: number) => x, 't/hasFalseAbsent');
    expect(registry().has(cap)).toBe(false);
  });

  it('throws TypeError for non-capability in layer', () => {
    expect(() => registry().layer({} as any, () => {})).toThrow(TypeError);
  });

  it('throws TypeError for non-capability in augment', () => {
    expect(() => registry().augment({} as any, (() => {}) as any)).toThrow(TypeError);
  });

  it('throws TypeError for non-function wrapper in augment', () => {
    const cap = capable((x: number) => x, 't/augmentNonFnWrapper');
    expect(() => registry().augment(cap, 'not a function' as any)).toThrow(TypeError);
  });

  it('registry is frozen', () => {
    expect(Object.isFrozen(registry())).toBe(true);
  });
});

describe('layer validation', () => {
  it('throws when value is undefined', () => {
    const cap = capable(() => 'base', 't/throwsValueUndefined');
    expect(() => registry().layer(cap, undefined as any)).toThrow(
      'layer: value cannot be undefined',
    );
  });

  it('throws when called with no args on a default-strategy capability', () => {
    const cap = capable(() => 'base', 't/throwsNoArgsDefault');
    expect(() => (registry().layer as any)(cap)).toThrow(
      'layer: value cannot be undefined',
    );
  });

  it('allows zero-arg layers when the capability has a strategy (Args = [])', () => {
    const cap = capable(() => 0, 't/zeroArgLayers', {
      strategy: {
        seed: 0,
        step: (parent: number | undefined) => () => (parent ?? 0) + 1,
        extract: (count: number) => () => count,
      },
    });
    const reg = registry().layer(cap).layer(cap);
    const resolved = merge(reg).resolve(cap);
    expect(resolved!()).toBe(2);
  });

  it('allows undefined layer values when the capability has a strategy — the strategy owns the empty case', () => {
    const cap = capable((x: number) => x, 't/undefinedLayerValues', {
      strategy: {
        step: (parent: number | undefined) => (v: number | undefined) => (parent ?? 0) + (v ?? 10),
        extract: (sum: number) => (_x: number) => sum,
      },
    });
    const reg = registry().layer(cap, undefined);
    const resolved = merge(reg).resolve(cap);
    expect(resolved!(0)).toBe(10);
  });
});
