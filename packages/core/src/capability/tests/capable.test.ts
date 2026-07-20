import { describe, expect, it } from 'vitest';
import { resolveCapable } from '../resolveCapable';
import { createChannelInternal } from '../../channel/slot';
import { CAPABILITY_BASE, CAPABILITY_CONFIG, CAPABILITY_TAG } from '../symbols';
import type { ResolvedRegistry } from '../../registry/types';
import { makeResolvedRegistry } from '../../registry/resolvedRegistry';

const passthrough = () => ({
  get: (): ResolvedRegistry => ({ resolve: () => null }),
  run: <T>(_: ResolvedRegistry | undefined, fn: () => T): T => fn(),
});

const noScope = () => ({
  get: (): ResolvedRegistry | undefined => undefined,
  run: <T>(_: ResolvedRegistry | undefined, fn: () => T): T => fn(),
});

describe('resolveCapable — entry point', () => {
  it('returns callable tagged with CAPABILITY_TAG', () => {
    const G = createChannelInternal('e1', passthrough());
    const cap = resolveCapable(G)((x: number) => x * 2, 't/tagged');
    expect(cap[CAPABILITY_TAG]).toBe(true);
    expect(typeof cap).toBe('function');
  });

  it('throws when called outside any registry scope', () => {
    const G = createChannelInternal('e3', noScope());
    const cap = resolveCapable(G)((x: number) => x, 't/outOfScope');
    expect(() => cap(1)).toThrow('called outside any registry scope');
  });

  it('names the capability in the outside-scope error', () => {
    const G = createChannelInternal('e3-named', noScope());
    const cap = resolveCapable(G)((x: number) => x, 't/fetchUser');
    expect(() => cap(1)).toThrow('fetchUser" called outside any registry scope');
  });

  it('throws for invalid channel object, eagerly at bind time', () => {
    const fake = { channel: Symbol(), name: 'x' };
    expect(() => resolveCapable(fake as any)).toThrow('mycl: invalid channel');
  });

  it('dispatches through resolved registry', () => {
    const mockImpl = (x: number) => x * 100;
    const G = createChannelInternal('e4', {
      get: (): ResolvedRegistry => ({ resolve: () => mockImpl }),
      run: <T>(_: ResolvedRegistry | undefined, fn: () => T): T => fn(),
    });
    const cap = resolveCapable(G)((x: number) => x, 't/dispatch');
    expect(cap(5)).toBe(500);
  });

  it('falls back to base when resolve returns null', () => {
    const G = createChannelInternal('e5', passthrough());
    const cap = resolveCapable(G)((x: number) => x * 2, 't/fallbackBase');
    expect(cap(5)).toBe(10);
  });

  it('throws TypeError when extract returns a non-function', () => {
    const G = createChannelInternal('e5b', {
      get: (): ResolvedRegistry => ({ resolve: () => 'not-a-function' as any }),
      run: <T>(_: ResolvedRegistry | undefined, fn: () => T): T => fn(),
    });
    const cap = resolveCapable(G)(() => 0, 't/myCapability');
    expect(() => cap()).toThrow('resolved to a non-function value');
    expect(() => cap()).toThrow('myCapability');
  });

  it('preserves CAPABILITY_BASE', () => {
    const G = createChannelInternal('e6', noScope());
    const base = (x: number) => x;
    const cap = resolveCapable(G)(base, 't/preservesBase');
    expect((cap as any)[CAPABILITY_BASE]).toBe(base);
  });

  it('attaches CAPABILITY_CONFIG when strategy provided', () => {
    const G = createChannelInternal('e7', noScope());
    const strategy = { extract: (s: string) => () => s, step: (_a: string | undefined) => (b: string) => b };
    const cap = resolveCapable(G)(() => 'x', 't/configStrategy', { strategy });
    expect((cap as any)[CAPABILITY_CONFIG]).toBe(strategy);
  });

  it('omits CAPABILITY_CONFIG when no strategy', () => {
    const G = createChannelInternal('e8', noScope());
    expect((resolveCapable(G)((): string => 'x', 't/noConfig') as any)[CAPABILITY_CONFIG]).toBeUndefined();
  });

  it('is frozen', () => {
    const G = createChannelInternal('e9', noScope());
    expect(Object.isFrozen(resolveCapable(G)((): string => 'x', 't/frozen'))).toBe(true);
  });

  it('preserves this binding', () => {
    const G = createChannelInternal('e10', passthrough());
    const fn = function (this: { n: number }, x: number) {
      return this.n * x;
    };
    expect(resolveCapable(G)(fn, 't/thisBinding').call({ n: 3 }, 4)).toBe(12);
  });
});

describe('resolveCapable', () => {
  it('returns pre-bound capable for the channel', () => {
    const G = createChannelInternal('cf1', passthrough());
    const cap = resolveCapable(G)((x: number) => x * 2, 't/preBound');
    expect(cap(5)).toBe(10);
  });

  it('passes strategy through', () => {
    const G = createChannelInternal('cf2', noScope());
    const strategy = { extract: (v: string) => () => v, step: (_a: string | undefined) => (b: string) => b };
    const cap = resolveCapable(G)(() => 'x', 't/passesStrategy', { strategy });
    expect((cap as any)[CAPABILITY_CONFIG]).toBe(strategy);
  });
});

describe('resolveCapable — dispatch cache', () => {
  it('resolve is called only once for the same sym', () => {
    let resolveCalls = 0;
    const handler = (x: number) => x * 100;
    const sym = Symbol('cache-test');
    const reg = makeResolvedRegistry(() => {
      resolveCalls++;
      return handler;
    }, sym);
    const G = createChannelInternal('cache1', {
      get: () => reg,
      run: <T>(_: unknown, fn: () => T): T => fn(),
    });
    const cap = resolveCapable(G)((x: number) => x, 't/cacheOnce');
    cap(5);
    cap(5);
    expect(resolveCalls).toBe(1);
  });

  it('null result is cached — base fn used on subsequent calls without re-resolving', () => {
    let resolveCalls = 0;
    const sym = Symbol('cache-null');
    const reg = makeResolvedRegistry(() => {
      resolveCalls++;
      return null;
    }, sym);
    const G = createChannelInternal('cache2', {
      get: () => reg,
      run: <T>(_: unknown, fn: () => T): T => fn(),
    });
    const cap = resolveCapable(G)((x: number) => x * 2, 't/cacheNull');
    expect(cap(5)).toBe(10);
    expect(cap(5)).toBe(10);
    expect(resolveCalls).toBe(1);
  });

  it('different syms cache independently', () => {
    let resolveCalls = 0;
    const handler = (x: number) => x * 10;
    const sym1 = Symbol('s1');
    const sym2 = Symbol('s2');
    const reg1 = makeResolvedRegistry(() => {
      resolveCalls++;
      return handler;
    }, sym1);
    const reg2 = makeResolvedRegistry(() => {
      resolveCalls++;
      return handler;
    }, sym2);
    let active: ResolvedRegistry = reg1;
    const G = createChannelInternal('cache3', {
      get: () => active,
      run: <T>(_: unknown, fn: () => T): T => fn(),
    });
    const cap = resolveCapable(G)((x: number) => x, 't/symsIndependent');
    cap(1); // populates sym1
    active = reg2;
    cap(1); // populates sym2
    active = reg1;
    cap(1); // cache hit for sym1
    expect(resolveCalls).toBe(2);
  });

  it('caches by ResolvedRegistry identity when no sym is registered', () => {
    let resolveCalls = 0;
    const handler = (x: number) => x * 2;
    const reg: ResolvedRegistry = { resolve: () => {
      resolveCalls++;
      return handler;
    } };
    const G = createChannelInternal('cache4', {
      get: (): ResolvedRegistry => reg,
      run: <T>(_: unknown, fn: () => T): T => fn(),
    });
    const cap = resolveCapable(G)((x: number) => x, 't/cacheByIdentity');
    expect(cap(1)).toBe(2);
    expect(cap(1)).toBe(2);
    expect(resolveCalls).toBe(1);
  });

  it('different sym-less ResolvedRegistry objects cache independently', () => {
    let resolveCalls = 0;
    const handler = (x: number) => x * 10;
    const reg1: ResolvedRegistry = { resolve: () => {
      resolveCalls++;
      return handler;
    } };
    const reg2: ResolvedRegistry = { resolve: () => {
      resolveCalls++;
      return handler;
    } };
    let active: ResolvedRegistry = reg1;
    const G = createChannelInternal('cache5', {
      get: (): ResolvedRegistry => active,
      run: <T>(_: unknown, fn: () => T): T => fn(),
    });
    const cap = resolveCapable(G)((x: number) => x, 't/symlessIndependent');
    cap(1); // populates cache for reg1
    active = reg2;
    cap(1); // populates cache for reg2
    active = reg1;
    cap(1); // cache hit for reg1
    expect(resolveCalls).toBe(2);
  });
});
