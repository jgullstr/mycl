/**
 * @file
 * The capability constructor: resolveCapable binds the factory to a channel and
 * returns the single capability constructor, which assembles the capability's
 * identifier, validates it in dev, and wires the dispatch path that reads the
 * active scope's registry, caches its resolution, and falls back to the base
 * function outside any binding.
 */

import type { AnyFn } from '../util/types';
import type { Capability, CapableConfig, IdPath, DispatchCache } from './types';
import type { Capable, Channel } from '../channel/types';
import { CAPABILITY_BASE, CAPABILITY_CONFIG, CAPABILITY_TAG, CAPABILITY_CACHE, CAPABILITY_ID } from './symbols';
import { getChannelSlot } from '../channel/slot';
import { getResolvedSym } from '../registry/resolvedRegistry';
import { defineInternal } from '../util/defineInternal';
import { errMsg, fmt, MESSAGES, ERR_OUT_OF_SCOPE, ERR_NON_FUNCTION_RESOLVE, ERR_INVALID_IDENTITY, ERR_DUPLICATE_IDENTITY } from '../util/errors';

/**
 * Dev-only registry of assembled identifiers seen this realm. A duplicate does not
 * break dispatch (the cache keys on the capability object), so it is a warning, not
 * a throw. A warning also avoids false positives under HMR / module re-evaluation.
 */
const seenIdentities = new Set<string>();

/**
 * Binds the capability factory to a channel: the single capability constructor.
 * `getChannelSlot` asserts the channel's provenance (eager fail-fast at bind time)
 * and captures its context cell once; every capability the returned factory
 * builds shares that cell, reading `slot.current` per dispatch so it still
 * follows setChannelContext swaps.
 */
export const resolveCapable = <G extends string>(channel: Channel<G>): Capable<G> => {
  const slot = getChannelSlot(channel);
  // Id stays constrained to plain `string`; the IdPath conditional on the
  // parameter rejects a definitely-empty literal with a message type and
  // passes any other literal through.
  return <T extends AnyFn, V = T, Args extends unknown[] = [V], const Id extends string = string>(
    baseFn: T | Capability<T, any, any, any>,
    idPath: IdPath<Id>,
    config?: CapableConfig<T, V, Args>,
  ): Capability<T, V, Args, `${G}:${Id}`> => {
    const id = `${channel.name}:${idPath}`;

    // Dev-only guards. The whole block is dropped from a production bundle (inline
    // NODE_ENV check, see errMsg in util/errors.ts): identifier validation backstops untyped/JS callers,
    // the duplicate check warns on a namespacing collision.
    if (process.env.NODE_ENV !== 'production') {
      if (!idPath) {
        throw new Error(errMsg(ERR_INVALID_IDENTITY, { identity: String(idPath) }));
      }
      if (seenIdentities.has(id)) {
        console.error(fmt(MESSAGES[ERR_DUPLICATE_IDENTITY], { identity: id }));
      } else {
        seenIdentities.add(id);
      }
    }

    const cache: DispatchCache = new WeakMap();

    // The `as Capability<…>` at the close is a freeze-boundary cast: TS can't assign a
    // plain function to the branded Capability intersection. Unavoidable, accepted.
    const callable = function capabilityCallable(this: unknown, ...args: unknown[]) {
      const registry = slot.current.get();
      if (registry === undefined) {
        throw new Error(errMsg(ERR_OUT_OF_SCOPE, { name: id }));
      }

      // One decision: which implementation. `null` is the cached use-base marker.
      const cacheKey = getResolvedSym(registry) ?? registry;
      if (!cache.has(cacheKey)) {
        const resolved = registry.resolve(callable);
        if (resolved !== null && typeof resolved !== 'function') {
          throw new TypeError(errMsg(ERR_NON_FUNCTION_RESOLVE, { name: id }));
        }
        cache.set(cacheKey, resolved);
      }
      return (cache.get(cacheKey) ?? baseFn).apply(this, args);
    } as Capability<T, V, Args, `${G}:${Id}`>;

    defineInternal(callable, CAPABILITY_TAG, true);
    defineInternal(callable, CAPABILITY_BASE, baseFn);
    defineInternal(callable, CAPABILITY_CACHE, cache);
    defineInternal(callable, CAPABILITY_ID, id);
    if (config?.strategy !== undefined) {
      defineInternal(callable, CAPABILITY_CONFIG, config.strategy);
    }

    return Object.freeze(callable);
  };
};
