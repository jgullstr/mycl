import { describe, expect, it, vi } from 'vitest';
import { capable } from './defaultContext';
import { registry } from '@mycl/core';
import { after, before, handleError, pipe } from '@mycl/core/helpers';
import { merge } from '@mycl/core/factory';

const resolve = (reg: ReturnType<typeof registry>, cap: any) =>
  merge(reg).resolve(cap);

describe('augmentation helpers', () => {
  describe('pipe', () => {
    it('pipes base result through transformers left-to-right', () => {
      const cap = capable((x: number) => x * 2, 't/pipeLeftToRight');
      const reg = registry()
        .layer(cap, (x: number) => x * 2)
        .augment(cap, pipe(
          (result) => result + 1,
          (result) => result * 10,
        ));

      expect(resolve(reg, cap)!(3)).toBe(70); // (3 * 2 + 1) * 10
    });

    it('single transformer', () => {
      const cap = capable((x: number) => x, 't/pipeSingle');
      const reg = registry()
        .layer(cap, (x: number) => x * 3)
        .augment(cap, pipe((result) => result + 5));

      expect(resolve(reg, cap)!(4)).toBe(17); // 4 * 3 + 5
    });

    it('no transformers returns base result unchanged', () => {
      const cap = capable((x: number) => x, 't/pipeNone');
      const reg = registry()
        .layer(cap, (x: number) => x * 2)
        .augment(cap, pipe());

      expect(resolve(reg, cap)!(5)).toBe(10);
    });
  });

  describe('before', () => {
    it('runs side effect before base call', () => {
      const order: string[] = [];
      const cap = capable(() => 'result', 't/beforeSideEffect');
      const reg = registry()
        .layer(cap, () => {
          order.push('base');
          return 'result';
        })
        .augment(cap, before(() => {
          order.push('before');
        }));

      const result = resolve(reg, cap)!();
      expect(result).toBe('result');
      expect(order).toEqual(['before', 'base']);
    });

    it('passes arguments to the side effect', () => {
      const cap = capable((..._args: [string, number]) => '', 't/beforePassesArgs');
      const spy = vi.fn();
      const reg = registry()
        .layer(cap, (a: string, b: number) => `${a}:${b}`)
        .augment(cap, before(spy));

      resolve(reg, cap)!('hello', 42);
      expect(spy).toHaveBeenCalledWith('hello', 42);
    });

    it('ignores async return from side effect', () => {
      const cap = capable(() => 'sync', 't/beforeIgnoresAsync');
      const reg = registry()
        .layer(cap, () => 'sync')
        .augment(cap, before(() => {
          void Promise.resolve();
        }));

      const result = resolve(reg, cap)!();
      expect(result).toBe('sync');
      expect(typeof result).toBe('string');
    });
  });

  describe('after', () => {
    it('runs side effect after base call', () => {
      const order: string[] = [];
      const cap = capable(() => 'result', 't/afterSideEffect');
      const reg = registry()
        .layer(cap, () => {
          order.push('base');
          return 'result';
        })
        .augment(cap, after(() => {
          order.push('after');
        }));

      const result = resolve(reg, cap)!();
      expect(result).toBe('result');
      expect(order).toEqual(['base', 'after']);
    });

    it('passes result and arguments to the side effect', () => {
      const cap = capable((..._args: [string, number]) => '', 't/afterPassesResultArgs');
      const spy = vi.fn();
      const reg = registry()
        .layer(cap, (a: string, b: number) => `${a}:${b}`)
        .augment(cap, after(spy));

      resolve(reg, cap)!('hello', 42);
      expect(spy).toHaveBeenCalledWith('hello:42', 'hello', 42);
    });

    it('does not contaminate return with side effect result', () => {
      const cap = capable(() => 'original', 't/afterNoContaminate');
      const reg = registry()
        .layer(cap, () => 'original')
        .augment(cap, after(() => 'should be ignored' as unknown as void));

      expect(resolve(reg, cap)!()).toBe('original');
    });
  });

  describe('handleError', () => {
    it('catches sync error and returns handler result', () => {
      const cap = capable(() => 'ok', 't/heCatchesSync');
      const reg = registry()
        .layer(cap, () => {
          throw new Error('boom');
        })
        .augment(cap, handleError(() => 'fallback'));

      expect(resolve(reg, cap)!()).toBe('fallback');
    });

    it('passes error and original args to handler', () => {
      const cap = capable((_a: string, _b: number) => '', 't/hePassesErrArgs');
      const spy = vi.fn(() => 'handled');
      const reg = registry()
        .layer(cap, () => {
          throw new Error('boom');
        })
        .augment(cap, handleError(spy));

      resolve(reg, cap)!('hello', 42);
      expect(spy).toHaveBeenCalledWith(expect.any(Error), 'hello', 42);
    });

    it('passes through base result when no error', () => {
      const cap = capable((x: number) => x, 't/hePassesThrough');
      const reg = registry()
        .layer(cap, (x: number) => x * 2)
        .augment(cap, handleError(() => -1));

      expect(resolve(reg, cap)!(5)).toBe(10);
    });

    it('re-throws when invariant does not match', () => {
      const cap = capable(() => '', 't/heRethrowNoMatch');
      const err = Object.assign(new Error('abort'), { name: 'AbortError' });
      const reg = registry()
        .layer(cap, () => {
          throw err;
        })
        .augment(cap, handleError(() => 'handled', (e: any) => e.name === 'NetworkError'));

      expect(() => resolve(reg, cap)!()).toThrow('abort');
    });

    it('catches when invariant matches', () => {
      const cap = capable(() => '', 't/heCatchesMatch');
      const err = Object.assign(new Error('abort'), { name: 'AbortError' });
      const reg = registry()
        .layer(cap, () => {
          throw err;
        })
        .augment(cap, handleError(() => 'handled', (e: any) => e.name === 'AbortError'));

      expect(resolve(reg, cap)!()).toBe('handled');
    });

    it('rethrow: true runs handler then re-throws', () => {
      const cap = capable(() => '', 't/heRethrowTrue');
      const spy = vi.fn();
      const reg = registry()
        .layer(cap, () => {
          throw new Error('boom');
        })
        .augment(cap, handleError(spy, undefined, { rethrow: true }));

      expect(() => resolve(reg, cap)!()).toThrow('boom');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('catches async rejected promise and returns handler result', async () => {
      const cap = capable(async () => 'ok', 't/heAsyncCatches');
      const reg = registry()
        .layer(cap, async () => {
          throw new Error('async boom');
        })
        .augment(cap, handleError(() => 'async fallback'));

      await expect(resolve(reg, cap)!()).resolves.toBe('async fallback');
    });

    it('async: re-throws when invariant does not match', async () => {
      const cap = capable(async () => '', 't/heAsyncRethrowNoMatch');
      const err = Object.assign(new Error('abort'), { name: 'AbortError' });
      const reg = registry()
        .layer(cap, async () => {
          throw err;
        })
        .augment(cap, handleError(() => 'handled', (e: any) => e.name === 'NetworkError'));

      await expect(resolve(reg, cap)!()).rejects.toThrow('abort');
    });

    it('async: rethrow: true runs handler then rejects', async () => {
      const cap = capable(async () => '', 't/heAsyncRethrowTrue');
      const spy = vi.fn();
      const reg = registry()
        .layer(cap, async () => {
          throw new Error('async boom');
        })
        .augment(cap, handleError(spy, undefined, { rethrow: true }));

      await expect(resolve(reg, cap)!()).rejects.toThrow('async boom');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('catches rejection from a non-Promise thenable', async () => {
      const thenable = {
        then: (_res: (v: unknown) => void, rej: (e: unknown) => void) => rej(new Error('boom')),
      };
      const cap = capable((() => thenable) as unknown as () => Promise<number>, 't/heThenableReject');
      const reg = registry().augment(cap, handleError(() => -1 as any));
      await expect(resolve(reg, cap)!()).resolves.toBe(-1);
    });

    it('composes with other helpers', () => {
      const order: string[] = [];
      const cap = capable((x: number) => x, 't/heComposes');
      const reg = registry()
        .layer(cap, (x: number) => {
          if (x < 0) {
            throw new Error('negative');
          }
          return x * 2;
        })
        .augment(cap, before(() => {
          order.push('before');
        }))
        .augment(cap, handleError((_err) => {
          order.push('error');
          return -1;
        }))
        .augment(cap, after(() => {
          order.push('after');
        }));

      expect(resolve(reg, cap)!(5)).toBe(10);
      expect(order).toEqual(['before', 'after']);

      order.length = 0;
      expect(resolve(reg, cap)!(-1)).toBe(-1);
      expect(order).toEqual(['before', 'error', 'after']);
    });
  });

  describe('composition', () => {
    it('before + after + pipe compose together', () => {
      const order: string[] = [];
      const cap = capable((x: number) => x, 't/compositionAll');
      const reg = registry()
        .layer(cap, (x: number) => {
          order.push('base');
          return x * 2;
        })
        .augment(cap, before(() => {
          order.push('before');
        }))
        .augment(cap, after(() => {
          order.push('after');
        }))
        .augment(cap, pipe((result) => {
          order.push('pipe');
          return result + 1;
        }));

      const result = resolve(reg, cap)!(5);
      expect(result).toBe(11); // 5 * 2 + 1
      expect(order).toEqual(['before', 'base', 'after', 'pipe']);
    });
  });
});
