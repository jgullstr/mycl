/**
 * @file
 * The AsyncLocalStorage-backed scope context: a ScopeContext whose scope
 * survives await boundaries, for channels that dispatch across async code.
 */

import type { ScopeContext } from './types';
import type { ResolvedRegistry } from '../registry/types';
import { errMsg, ERR_NO_ASYNC_HOOKS } from '../util/errors';

/**
 * AsyncLocalStorage-backed {@link ScopeContext}: one store minted per call,
 * carrying the scoped registry across await boundaries inside `run`.
 *
 * The async_hooks builtin loads lazily via `process.getBuiltinModule`,
 * deliberately never a static top-level import: a static import would be bundled
 * into every consumer, breaking browser targets even for consumers that never
 * touch alsContext. When the runtime does not expose `process.getBuiltinModule`
 * (Node older than 20.16, or a non-Node runtime), this throws
 * {@link ERR_NO_ASYNC_HOOKS}; reach for {@link stackContext} there instead.
 */
export const alsContext = (): ScopeContext<ResolvedRegistry> => {
  const proc = globalThis.process;
  if (typeof proc?.getBuiltinModule !== 'function') {
    throw new Error(errMsg(ERR_NO_ASYNC_HOOKS));
  }
  const { AsyncLocalStorage } = proc.getBuiltinModule('node:async_hooks');
  const storage = new AsyncLocalStorage<ResolvedRegistry | undefined>();
  return {
    get: () => storage.getStore(),
    run: (value, fn) => storage.run(value, fn),
  };
};
