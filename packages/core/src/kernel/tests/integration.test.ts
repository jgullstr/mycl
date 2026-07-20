import { describe, expect, it } from 'vitest';
import { capable, snapshot } from './defaultContext';
import mycl from './mycl';
import { registry } from '@mycl/core';
import { before } from '@mycl/core/helpers';

describe('full resolution algorithm', () => {
  it('capability throws when called outside any registry scope', () => {
    const cap = capable((x: number) => x * 2, 't/outsideScope');
    expect(() => cap(5)).toThrow('called outside any registry scope');
  });

  it('capability inside scope returns registered impl', () => {
    const cap = capable((x: number) => x * 2, 't/insideScope');
    const reg = registry().layer(cap, (x: number) => x * 100);
    const app = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), reg)();
    expect(app.calc(5)).toBe(500);
  });

  it('augment wraps default when no set exists', () => {
    const cap = capable((x: number) => x * 2, 't/augmentNoSet');
    const reg = registry().augment(cap, (next) => (x: number) => next(x) + 1);
    const app = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), reg)();
    expect(app.calc(5)).toBe(11);
  });

  it('set replaces core, augments survive across layers', () => {
    const cap = capable((x: number) => x, 't/setReplacesCore');
    const base = registry()
      .layer(cap, (x: number) => x * 2)
      .augment(cap, before((_x: number) => {}));
    const makeApp = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), base);

    const override = registry().layer(cap, (x: number) => x * 3);
    expect(mycl(makeApp, override)().calc(5)).toBe(15);
  });

  it('multiple augments compose inner-to-outer across layers', () => {
    const cap = capable((x: number) => x, 't/multipleAugments');
    const base = registry()
      .layer(cap, (x: number) => x * 2)
      .augment(cap, (next) => (x: number) => next(x) + 10);
    const plugin = registry().augment(cap, (next) => (x: number) => next(x) * 100);

    const app = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), base, plugin)();
    expect(app.calc(5)).toBe(2000);
  });

  it('theme-style capability with step = concat', () => {
    const cap = capable(() => 'default', 't/themeConcat', {
      strategy: {
        extract: (s: string) => () => s,
        step: (a: string | undefined) => (b: string) => a !== undefined ? `${a} ${b}` : b,
      },
    });
    const base = registry().layer(cap, 'bg-blue-500');
    const compact = registry().layer(cap, 'px-2 py-1');
    const app = mycl(() => ({ classes: snapshot(() => cap()) }), base, compact)();
    expect(app.classes()).toBe('bg-blue-500 px-2 py-1');
  });

  it('nested instances compose correctly', () => {
    const innerCap = capable((x: number) => x * 2, 't/nestedInner');
    const innerApp = mycl(() => ({ calc: snapshot((x: number) => innerCap(x)) }),
      registry().layer(innerCap, (x: number) => x * 3),
    )();
    const outerApp = mycl(() => ({ compute: snapshot((x: number) => innerApp.calc(x)) }), registry())();
    expect(outerApp.compute(5)).toBe(15);
  });
});
