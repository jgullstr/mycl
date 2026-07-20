/**
 * @file
 * Standalone augmentation helpers: pure generics over the capability's
 * function type T, inferred contextually at the `augment(cap, …)` call site.
 * A raw `AugmentWrapper<T>` passes to `augment` directly; these are optional
 * vocabulary, imported from `@mycl/core/helpers`.
 */

import type { AnyFn, AugmentWrapper, Transform } from './types';

/**
 * Runs `fn` with the arguments before each call to the capability.
 */
export const before = <T extends AnyFn>(
  fn: (...args: Parameters<T>) => void,
): AugmentWrapper<T> =>
  (next) => ((...args: Parameters<T>) => {
    fn(...args);
    return next(...args);
  }) as T;

/**
 * Runs `fn` with the result and arguments after each call. Observes the
 * return value as-is: for async capabilities that is the Promise, so await
 * inside the handler if you need the settled value.
 */
export const after = <T extends AnyFn>(
  fn: (result: ReturnType<T>, ...args: Parameters<T>) => void,
): AugmentWrapper<T> =>
  (next) => ((...args: Parameters<T>) => {
    const result = next(...args) as ReturnType<T>;
    fn(result, ...args);
    return result;
  }) as T;

/**
 * Chains result transformers left-to-right over the capability's return
 * value. Sync-only: for async capabilities the value piped is the Promise.
 */
export const pipe = <T extends AnyFn>(
  ...fns: Transform<T>[]
): AugmentWrapper<T> => {
  // Pre-compose the chain once at augment time, so each call is a single
  // pipeline invocation, not a fresh `fns.reduce` that reallocates its
  // reducer and re-walks the array on every call.
  const pipeline: Transform<T> = fns.length === 0
    ? (value: ReturnType<T>) => value
    : fns.reduce((f, g) => (value: ReturnType<T>) => g(f(value)));
  return (next) => ((...args: Parameters<T>) =>
    pipeline(next(...args) as ReturnType<T>)) as T;
};

/**
 * Catches sync throws and async rejections (any thenable). With
 * `rethrow: true` the handler runs for its side effects only: its return
 * value is discarded and the original error is rethrown.
 */
export const handleError = <T extends AnyFn>(
  handler: (error: unknown, ...args: Parameters<T>) => ReturnType<T> | Awaited<ReturnType<T>>,
  shouldHandle?: (error: unknown) => boolean,
  options?: { rethrow?: boolean },
): AugmentWrapper<T> => {
  // `handle` is built once at augment time: it closes only over augment-time
  // bindings (handler/shouldHandle/rethrow) and takes the call's args as a
  // parameter, so the base path allocates no per-call closure. The async path
  // binds args in a small arrow only when the result is actually a thenable.
  const rethrow = options?.rethrow ?? false;
  const handle = (error: unknown, args: Parameters<T>): ReturnType<T> => {
    if (shouldHandle !== undefined && !shouldHandle(error)) {
      throw error;
    }
    // The cast admits Awaited<ReturnType<T>>: on the sync-throw path of an
    // async capability the handler's settled value is returned as-is, which
    // await-callers flatten; a rare `.then`-caller would see a plain value.
    const result = handler(error, ...args) as ReturnType<T>;
    if (rethrow) {
      // Side-effects-only mode: the handler's return value is discarded.
      // If it returned a thenable, silence it: a rejecting async handler
      // must not surface as an unhandled rejection on top of the rethrow.
      if (typeof (result as { then?: unknown } | null | undefined)?.then === 'function') {
        Promise.resolve(result).catch(() => {});
      }
      throw error;
    }
    return result;
  };
  return (next) => ((...args: Parameters<T>) => {
    try {
      const result = next(...args);
      if (typeof (result as { then?: unknown } | null | undefined)?.then === 'function') {
        return Promise.resolve(result).catch((error) => handle(error, args)) as ReturnType<T>;
      }
      return result as ReturnType<T>;
    } catch (error) {
      return handle(error, args);
    }
  }) as T;
};
