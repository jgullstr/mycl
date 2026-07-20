import { afterEach, describe, expect, it, vi } from 'vitest';
import { alsContext } from '../als';
import type { ResolvedRegistry } from '../../registry/types';

// Sentinel stores: the context mechanism holds whatever it is given, it never
// inspects it, so plain tagged objects stand in for real resolved registries.
const store = (tag: string): ResolvedRegistry =>
  ({ resolve: () => null, tag }) as unknown as ResolvedRegistry;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('alsContext', () => {
  it('is a working ScopeContext: get/run round-trip', () => {
    const ctx = alsContext();
    const value = store('a');

    expect(ctx.get()).toBeUndefined();
    ctx.run(value, () => {
      expect(ctx.get()).toBe(value);
    });
    expect(ctx.get()).toBeUndefined();
  });

  it('carries the scope across an await inside run (the ALS guarantee)', async () => {
    const ctx = alsContext();
    const value = store('across-await');

    // run is synchronous-returning, but the callback may be async: ALS keeps the
    // store bound to the async context, so after an await get() still sees it.
    await ctx.run(value, async () => {
      expect(ctx.get()).toBe(value);
      await Promise.resolve();
      expect(ctx.get()).toBe(value);
    });

    expect(ctx.get()).toBeUndefined();
  });

  it('mints an independent store per call', () => {
    const a = alsContext();
    const b = alsContext();
    const valueA = store('a');
    const valueB = store('b');

    a.run(valueA, () => {
      // b has nothing installed while a is active: the stores do not share state.
      expect(b.get()).toBeUndefined();
      b.run(valueB, () => {
        expect(a.get()).toBe(valueA);
        expect(b.get()).toBe(valueB);
      });
    });
  });

  it('throws the coded error when process.getBuiltinModule is absent', () => {
    // Keep env so the dev/prod gate in errMsg still resolves; drop
    // getBuiltinModule so the guard fires.
    vi.stubGlobal('process', { env: { ...process.env } });
    expect(() => alsContext()).toThrow(/alsContext requires process\.getBuiltinModule/);
  });
});
