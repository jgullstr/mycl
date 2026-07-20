import { describe, expect, it } from 'vitest';
import { capable } from './defaultContext';
import mycl from './mycl';
import { snapshot } from './defaultContext';
import { registry } from '@mycl/core';

describe('snapshot (kernel)', () => {
  it('preserves scope across .then()', async () => {
    const cap = capable((x: number) => x * 2, 't/scopeAcrossThen');
    const app = mycl(() => ({
      fetch: snapshot(async (x: number) => {
        const handler = snapshot((val: number) => cap(val));
        return Promise.resolve(x).then(handler);
      }),
    }), registry().layer(cap, (x: number) => x * 100))();
    expect(await app.fetch(5)).toBe(500);
  });

  it('preserves async return values', async () => {
    const cap = capable(async (x: number) => x * 2, 't/asyncReturn');
    const app = mycl(() => ({
      compute: snapshot(async (x: number) => {
        const handler = snapshot(async (val: number) => cap(val));
        return handler(x);
      }),
    }), registry().layer(cap, async (x: number) => x * 100))();
    expect(await app.compute(5)).toBe(500);
  });

  it('preserves async rejection', async () => {
    const cap = capable(async () => {
      throw new Error('boom');
    }, 't/asyncRejection');
    const app = mycl(() => ({
      fail: snapshot(async () => {
        const handler = snapshot(async () => cap());
        return handler();
      }),
    }), registry().layer(cap, async () => {
      throw new Error('registered boom');
    }))();
    await expect(app.fail()).rejects.toThrow('registered boom');
  });

  it('taken outside a scope, pins no-scope — capability stays loud', () => {
    const cap = capable((x: number) => x * 2, 't/noScopePinned');
    const inner = (x: number) => cap(x);
    const snapped = snapshot(inner);
    expect(snapped).not.toBe(inner);
    const app = mycl(
      () => ({ run: snapshot((x: number) => snapped(x)) }),
      registry().layer(cap, (x: number) => x * 100),
    )();
    // snapshot pinned "no scope" — ambient mycl scope is shadowed, error stays loud
    expect(() => app.run(5)).toThrow('called outside any registry scope');
  });

  it('throws after await without snapshot — scope is required', async () => {
    const cap = capable((x: number) => x * 2, 't/throwsAfterAwait');
    const app = mycl(() => ({
      run: snapshot(async (x: number) => {
        const beforeAwait = cap(x);
        await Promise.resolve();
        // scope has unwound — capability throws instead of silently returning wrong result
        cap(x);
        return beforeAwait;
      }),
    }), registry().layer(cap, (x: number) => x * 100))();

    await expect(app.run(5)).rejects.toThrow('called outside any registry scope');
  });

  it('snapshot() preserves scope across await', async () => {
    const cap = capable((x: number) => x * 2, 't/scopeAcrossAwait');
    const app = mycl(() => ({
      run: snapshot(async (x: number) => {
        const scopedCap = snapshot(cap);
        const beforeAwait = cap(x);
        await Promise.resolve();
        return { beforeAwait, afterAwait: scopedCap(x) };
      }),
    }), registry().layer(cap, (x: number) => x * 100))();

    const { beforeAwait, afterAwait } = await app.run(5);
    expect(beforeAwait).toBe(500);
    expect(afterAwait).toBe(500);
  });

  it('preserves call-site this binding', () => {
    const app = mycl(() => ({
      multiply: snapshot(function (this: { factor: number }, x: number) {
        return this.factor * x;
      }),
    }), registry())();
    expect(app.multiply.call({ factor: 6 }, 7)).toBe(42);
  });
});
