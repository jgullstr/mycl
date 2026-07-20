import { describe, expect, expectTypeOf, it } from 'vitest';
import { createChannel } from '../channel/createChannel';
import { after, before, handleError, pipe } from '../util/helpers';
import { registry } from '../registry/registry';
import { merge } from '../registry/merge';
import { connectorOf } from './connectorOf';

const { capable } = createChannel('helpers-test', connectorOf({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() }));
const resolve = (reg: ReturnType<typeof registry>, cap: any) => merge(reg).resolve(cap);

describe('standalone augmentation helpers', () => {
  it('pipe transforms left-to-right with inferred types', () => {
    const cap = capable((x: number) => x, 't/pipeChain');
    const reg = registry()
      .layer(cap, (x: number) => x * 2)
      .augment(cap, pipe((r) => r + 1, (r) => r * 10));
    expect(resolve(reg, cap)!(3)).toBe(70);
  });

  it('infers the transformer value type from the capability', () => {
    const greet = capable((name: string) => name, 't/inferTransformer');
    registry().augment(greet, pipe((s) => {
      expectTypeOf(s).toEqualTypeOf<string>();
      return s.toUpperCase();
    }));
  });

  it('rejects a transformer with the wrong return type', () => {
    const greet = capable((name: string) => name.length, 't/rejectWrongReturn');
    // @ts-expect-error — transformer must return number (the capability's ReturnType)
    registry().augment(greet, pipe((n: number) => `${n}`));
  });

  it('before/after run around the base call', () => {
    const order: string[] = [];
    const cap = capable(() => 'r', 't/beforeAfter');
    const reg = registry()
      .layer(cap, () => {
        order.push('base');
        return 'r';
      })
      .augment(cap, before(() => order.push('before')))
      .augment(cap, after(() => order.push('after')));
    resolve(reg, cap)!();
    expect(order).toEqual(['before', 'base', 'after']);
  });

  it('handleError catches and returns the handler result', () => {
    const cap = capable(() => 'ok', 't/handleErrorReturn');
    const reg = registry()
      .layer(cap, () => {
        throw new Error('boom');
      })
      .augment(cap, handleError(() => 'fallback'));
    expect(resolve(reg, cap)!()).toBe('fallback');
  });

  it('augment accepts a raw wrapper directly, fully typed', () => {
    const cap = capable((x: number) => x, 't/rawWrapper');
    const reg = registry()
      .layer(cap, (x: number) => x)
      .augment(cap, (next) => (x: number) => next(x) + 100);
    expect(resolve(reg, cap)!(1)).toBe(101);
  });
});

describe('handleError rethrow with async handler', () => {
  it('rethrows the original error and silences the handler\'s rejecting promise', async () => {
    const cap = capable(() => 'ok', 't/handleErrorRethrow');
    const reg = registry()
      .layer(cap, () => {
        throw new Error('base boom');
      })
      .augment(cap, handleError(
        (() => Promise.reject(new Error('handler boom'))) as any,
        undefined,
        { rethrow: true },
      ));
    let unhandled: unknown;
    const onUnhandled = (reason: unknown) => {
      unhandled = reason;
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      expect(() => resolve(reg, cap)!()).toThrow('base boom');
      await new Promise((r) => setTimeout(r, 20)); // let any unhandled rejection surface
      expect(unhandled).toBeUndefined();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('augment canary (dev-only)', () => {
  it('rejects a builder-style argument (h => h.after(fn)) at registration', () => {
    const cap = capable((x: number) => x, 't/builderStyle');
    const builder = (h: any) => h.after(() => {});
    expect(() => registry().augment(cap, builder as any)).toThrow(
      /canary probe/,
    );
  });

  it('rejects a unary function that returns a non-function', () => {
    const cap = capable((x: number) => x, 't/unaryNonFunction');
    expect(() => registry().augment(cap, ((_h: unknown) => 42) as any)).toThrow(
      /received a builder/,
    );
  });
});
