import { describe, expect, it } from 'vitest';
import { createChannel } from '../../channel/createChannel';
import { foldBindings, isValidLayer } from '../fold';
import { connectorOf } from '../../tests/connectorOf';

const { capable } = createChannel('strategy-test', connectorOf({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() }));

// foldBindings is the single fold both merge() and the eager one-pass path route through.
// These exercise the strategy semantics (defaults, seed, custom step)
// and the resolution tail (null / augments-over-base / extract-then-augment).
describe('foldBindings', () => {
  const base = () => 'base';

  it('returns null for a no-strategy capability with no contributions', () => {
    const cap = capable(base, 't/noStrategyNoContrib');
    expect(foldBindings(cap, [])).toBeNull();
  });

  it('last-wins default: resolves to the final layered impl', () => {
    const cap = capable((x: number) => x, 't/lastWinsDefault');
    const a = (x: number) => x + 1;
    const b = (x: number) => x + 2;
    const resolved = foldBindings(cap, [{ argsList: [[a], [b]], augments: [] }]);
    expect(resolved!(10)).toBe(12);
  });

  it('applies augments over base when no value is contributed', () => {
    const cap = capable(base, 't/augmentsOverBase');
    const resolved = foldBindings(cap, [{ argsList: [], augments: [[(next: () => unknown) => () => `[${next()}]`]] }]);
    expect(resolved!()).toBe('[base]');
  });

  it('seeds the fold and folds through a custom step, then extracts', () => {
    const cap = capable(base, 't/seedsFold', {
      strategy: {
        step: (p: string | undefined) => (c: string) => `${p ?? ''} ${c}`,
        extract: (v: string) => () => v,
        seed: 'x',
      },
    });
    const resolved = foldBindings(cap, [{ argsList: [['a'], ['b']], augments: [] }]);
    expect(resolved!()).toBe('x a b');
  });

  it('extracts the value then applies augments', () => {
    const cap = capable(base, 't/extractThenAugment', {
      strategy: { step: (_p: string | undefined) => (c: string) => c, extract: (v: string) => () => v },
    });
    const resolved = foldBindings(cap, [{ argsList: [['val']], augments: [[(next: () => unknown) => () => `[${next()}]`]] }]);
    expect(resolved!()).toBe('[val]');
  });

  it('passes the capability base to extract as the second argument', () => {
    const base = () => 'BASE';
    const cap = capable(base, 't/baseToExtract', {
      strategy: {
        step: (_p: string | undefined) => (c: string) => c,
        extract: (v: string, b: () => unknown) => () => `${v}(${b()})`,
      },
    });
    const resolved = foldBindings(cap, [{ argsList: [['v']], augments: [] }]);
    expect(resolved!()).toBe('v(BASE)');
  });

  it('folds identically whether contributions arrive as one entry or several', () => {
    const cap = capable(base, 't/foldsIdentically', {
      strategy: {
        step: (p: string | undefined) => (c: string) => `${p ?? ''}${c}`,
        extract: (v: string) => () => v,
      },
    });
    const merged = foldBindings(cap, [{ argsList: [['a'], ['b']], augments: [] }]);
    const split = foldBindings(cap, [{ argsList: [['a']], augments: [] }, { argsList: [['b']], augments: [] }]);
    expect(merged!()).toBe('ab');
    expect(split!()).toBe('ab');
  });

  it('seed is a fold seed, not a no-layers trigger: no contributions falls back to base despite seed', () => {
    const reducer = {
      step: (acc: Record<string, boolean>) => (k: string) => ({ ...acc, [k]: true }),
      extract: (v: Record<string, boolean>) => () => v,
      seed: {} as Record<string, boolean>,
    };
    const cap = capable(() => 'base', 't/seedFold', { strategy: reducer as any });
    // No layers → nothing runs → null (caller uses base), despite the seed.
    expect(foldBindings(cap, [{ argsList: [], augments: [] }])).toBeNull();
    // With layers, seed seeds the fold so step needs no undefined check.
    const resolved = foldBindings(cap, [{ argsList: [['a'], ['b']], augments: [] }]);
    expect(resolved!() as Record<string, boolean>).toEqual({ a: true, b: true });
  });
});

describe('isValidLayer', () => {
  it('default-strategy capability rejects empty or undefined args', () => {
    const cap = capable((x: number) => x, 't/rejectsEmptyArgs');
    expect(isValidLayer(cap as any, [])).toBe(false);
    expect(isValidLayer(cap as any, [undefined])).toBe(false);
  });

  it('default-strategy capability accepts a defined value', () => {
    const cap = capable((x: number) => x, 't/acceptsDefinedValue');
    expect(isValidLayer(cap as any, [5])).toBe(true);
  });

  it('custom-strategy capability accepts any args (it owns its Args)', () => {
    const cap = capable(() => '', 't/customAcceptsAny', {
      strategy: { step: (p: string | undefined) => (c: string) => (p ?? '') + c, extract: (s: string) => () => s },
    });
    expect(isValidLayer(cap as any, [])).toBe(true);
    expect(isValidLayer(cap as any, [undefined])).toBe(true);
  });
});
