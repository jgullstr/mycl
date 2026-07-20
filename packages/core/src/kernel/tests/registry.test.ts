import { describe, expect, it } from 'vitest';
import { registry } from '@mycl/core';
import { merge } from '@mycl/core/factory';
import { capable } from './defaultContext';

describe('registry (default kernel registry)', () => {
  it('creates an empty registry', () => {
    const reg = registry();
    expect(reg).toBeDefined();
  });

  it('set and resolve a capability', () => {
    const cap = capable((x: number) => x, 't/setResolve');
    const reg = registry().layer(cap, (x: number) => x * 10);
    const resolved = merge(reg).resolve(cap);
    expect(resolved!(3)).toBe(30);
  });

  it('step is last-wins', () => {
    const cap = capable((x: number) => x, 't/stepLastWins');
    const regA = registry().layer(cap, (x: number) => x * 5);
    const regB = registry().layer(cap, (x: number) => x * 10);
    // last-wins: regB overrides regA
    const resolved = merge(regA, regB).resolve(cap);
    expect(resolved!(3)).toBe(30);
  });

  it('extract is identity for functions', () => {
    const cap = capable((x: number) => x, 't/assembleIdentity');
    const impl = (x: number) => x * 7;
    const reg = registry().layer(cap, impl);
    const resolved = merge(reg).resolve(cap);
    expect(resolved).toBe(impl);
  });

  it('augment wraps resolved callable', () => {
    const cap = capable((x: number) => x, 't/augmentWraps');
    const reg = registry()
      .layer(cap, (x: number) => x * 2)
      .augment(cap, (next) => (x: number) => next(x) + 1);
    const resolved = merge(reg).resolve(cap);
    expect(resolved!(5)).toBe(11); // (5*2) + 1
  });

  it('multiple augments compose inner-to-outer', () => {
    const cap = capable((x: number) => x, 't/augmentCompose');
    const reg = registry()
      .layer(cap, (x: number) => x * 2)
      .augment(cap, (next) => (x: number) => next(x) + 10) // inner
      .augment(cap, (next) => (x: number) => next(x) * 100); // outer
    const resolved = merge(reg).resolve(cap);
    // inner: (5*2) + 10 = 20
    // outer: 20 * 100 = 2000
    expect(resolved!(5)).toBe(2000);
  });
});
