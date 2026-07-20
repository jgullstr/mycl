/**
 * @file
 * The contract between scope implementations and dispatch: how a value is
 * held for the duration of a call and read back out.
 */

/**
 * Scoped access to a value: stores and retrieves, never inspects.
 * Implementations: {@link stackContext} (synchronous call-stack) and
 * {@link alsContext} (AsyncLocalStorage, survives await boundaries).
 */
export interface ScopeContext<R = unknown> {
  /**
   * Returns the current value, or undefined if no scope is active.
   */
  get: () => R | undefined;
  /**
   * Executes `fn` within the scope of `value` and returns its result. Must be
   * synchronous. `undefined` pins scopelessness: inside `fn`, `get()` returns
   * undefined even when an outer scope is active.
   */
  run: <T>(value: R | undefined, fn: () => T) => T;
}
