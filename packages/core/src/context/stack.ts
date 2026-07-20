/**
 * @file
 * The synchronous scope-context implementation: a plain array used as a
 * stack, pushed and popped around each `run`.
 */

import type { ScopeContext } from './types';
import type { ResolvedRegistry } from '../registry/types';

/**
 * Stack-based {@link ScopeContext} for synchronous dynamic scoping.
 *
 * `run` pushes the registry onto the stack before calling `fn`, always pops after.
 * `get` reads the top of the stack.
 *
 * `R` defaults to `ResolvedRegistry` (what `createChannel` requires) so
 * `stackContext()` needs no annotation in the common case.
 */
const stackContext = <R = ResolvedRegistry>(): ScopeContext<R> => {
  const entries: (R | undefined)[] = [];

  return {
    get: () => entries[entries.length - 1],
    run: <T>(registry: R | undefined, fn: () => T): T => {
      entries.push(registry);
      try {
        return fn();
      } finally {
        entries.pop();
      }
    },
  };
};

export default stackContext;
