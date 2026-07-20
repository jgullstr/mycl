import { afterEach, describe, expect, it } from 'vitest';
import { registry, setChannelContext } from '@mycl/core';
import { stackContext } from '@mycl/core/context';
import type { ResolvedRegistry } from '@mycl/core';
import { capable, snapshot } from './defaultContext';
import { FN_CHANNEL } from './defaultContext';
import mycl from './mycl';
import { scope } from './scope';

/** Models the documented AsyncLocalStorage wiring: get/run read/write a single store slot. */
const makeAlsLikeContext = () => {
  let store: ResolvedRegistry | undefined;
  return {
    get: () => store,
    run: <T>(reg: ResolvedRegistry | undefined, fn: () => T): T => {
      const prev = store;
      store = reg;
      try {
        return fn();
      } finally {
        store = prev;
      }
    },
  };
};

afterEach(() => {
  setChannelContext(FN_CHANNEL, stackContext());
});

describe('setChannelContext(FN_CHANNEL, ...) swap', () => {
  it('mycl instance built before the swap keeps dispatching correctly afterwards', () => {
    const cap = capable((x: number) => x * 2, 't/builtBeforeSwap');
    const reg = registry().layer(cap, (x: number) => x * 100);
    const app = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), reg)();

    setChannelContext(FN_CHANNEL, makeAlsLikeContext());

    expect(app.calc(5)).toBe(500);
  });

  it('mycl instance built after the swap dispatches through the swapped-in context', () => {
    setChannelContext(FN_CHANNEL, makeAlsLikeContext());

    const cap = capable((x: number) => x * 2, 't/builtAfterSwap');
    const reg = registry().layer(cap, (x: number) => x * 100);
    const app = mycl(() => ({ calc: snapshot((x: number) => cap(x)) }), reg)();

    expect(app.calc(5)).toBe(500);
  });

  it('scope() built after the swap dispatches through the swapped-in context', () => {
    setChannelContext(FN_CHANNEL, makeAlsLikeContext());

    const cap = capable((x: number) => x * 2, 't/scopeAfterSwap');
    const reg = registry().layer(cap, (x: number) => x * 100);
    const fn = (x: number) => cap(x);
    const bound = scope(fn, reg);

    expect(bound(5)).toBe(500);
  });
});
