import { describe, expect, it } from 'vitest';
import { merge } from '@mycl/core/factory';
import { capable } from './defaultContext';
import { registry } from '@mycl/core';
import { scope } from './scope';

describe('merge', () => {
  it('merge() with no args — capability falls back to base', () => {
    const cap = capable((x: number) => x * 2, 't/noArgsFallback');
    const fn = (x: number) => cap(x);
    expect(scope(fn, merge())(5)).toBe(10);
  });

  it('merge(reg) — single registry resolves correctly', () => {
    const cap = capable((x: number) => x * 2, 't/singleRegistry');
    const reg = registry().layer(cap, (x: number) => x * 100);
    const fn = (x: number) => cap(x);
    expect(scope(fn, merge(reg))(5)).toBe(500);
  });

  it('merge(reg1, reg2) — later registry overrides earlier', () => {
    const cap = capable((x: number) => x * 2, 't/laterOverrides');
    const base = registry().layer(cap, (x: number) => x * 10);
    const override = registry().layer(cap, (x: number) => x * 100);
    const fn = (x: number) => cap(x);
    expect(scope(fn, merge(base, override))(5)).toBe(500);
  });

  it('merge(reg1, reg2) — augments stack across both registries', () => {
    const cap = capable((x: number) => x, 't/augmentsStack');
    const r1 = registry()
      .layer(cap, (x: number) => x * 2)
      .augment(cap, (next) => (x: number) => next(x) + 10);
    const r2 = registry().augment(cap, (next) => (x: number) => next(x) * 100);
    const fn = (x: number) => cap(x);
    // set: x*2, r1 augment: +10, r2 augment: *100 → ((5*2)+10)*100 = 2000
    expect(scope(fn, merge(r1, r2))(5)).toBe(2000);
  });
});
