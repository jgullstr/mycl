/**
 * @file
 * The resolved-registry plumbing: makeResolvedRegistry mints a ResolvedRegistry
 * and registers its dispatch-cache sym, so capabilityCallable and merge() can
 * use a ResolvedRegistry as a stable cache key.
 */

import type { ResolvedRegistry, Resolver } from './types';
import { errMsg, ERR_SYMBOL_FOR_KEY } from '../util/errors';

const resolvedRegistrySyms = new WeakMap<ResolvedRegistry, symbol>();

/**
 * Returns the dispatch sym for a ResolvedRegistry, or undefined if it was not
 * created via makeResolvedRegistry / merge.
 */
export const getResolvedSym = (reg: ResolvedRegistry): symbol | undefined =>
  resolvedRegistrySyms.get(reg);

/**
 * Guards a dispatch-cache key. A registered symbol (`Symbol.for`) is shared across
 * the whole realm, so it would alias the per-capability cache across unrelated
 * registries; only a unique `Symbol()` is safe. Used by `makeResolvedRegistry`.
 */
export const assertCacheableSym = (sym: symbol): void => {
  if (Symbol.keyFor(sym) !== undefined) {
    throw new TypeError(errMsg(ERR_SYMBOL_FOR_KEY));
  }
};

/**
 * Creates a ResolvedRegistry and registers sym so capabilityCallable can use it
 * as a cache key.
 */
export const makeResolvedRegistry = (resolver: Resolver, sym: symbol): ResolvedRegistry => {
  assertCacheableSym(sym);
  const reg: ResolvedRegistry = { resolve: resolver };
  resolvedRegistrySyms.set(reg, sym);
  return reg;
};
