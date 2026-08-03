/**
 * @file
 * The registry primitive: an immutable, layerable map from capability to its
 * contributions, derived clone-on-write through layer() and augment().
 */

import type { AnyFn, AugmentWrapper } from '../util/types';
import type { Capability, AnyCapability } from '../capability/types';
import type { Registry, RegistryBindingValue } from './types';
import { errMsg, fmt, MESSAGES, ERR_LAYER_TARGET, ERR_LAYER_UNDEFINED, ERR_AUGMENT_TARGET, ERR_AUGMENT_NOT_FUNCTION, ERR_AUGMENT_BUILDER, ERR_AUGMENT_CANARY_THREW } from '../util/errors';
import isCapability from '../capability/isCapability';
import { isValidLayer } from '../strategy/fold';

// The probe below is handed to the wrapper, never called by it: a wrapper composes
// around `next`, it does not invoke it at build time. Uncoverable by construction.
/* v8 ignore next */
const canaryNoop: AnyFn = () => undefined;

/**
 * Builds a Registry over a Map it is given exclusive ownership of (no defensive
 * copy). `clone` produces a fresh owned Map per derivation and the public
 * `registry()` starts from a fresh empty Map, so the internal path allocates
 * exactly one Map per operation.
 */
const makeRegistry = (entries: Map<AnyCapability, RegistryBindingValue>): Registry => {
  const clone = (patch: (map: Map<AnyCapability, RegistryBindingValue>) => void): Registry => {
    const next = new Map(entries);
    patch(next);
    return makeRegistry(next);
  };

  const self = {
    layer: (cap: AnyCapability, ...args: unknown[]): Registry => {
      if (!isCapability(cap)) {
        throw new TypeError(errMsg(ERR_LAYER_TARGET));
      }
      // The capability's strategy owns what a valid contribution looks like (see strategy/fold.ts).
      if (!isValidLayer(cap, args)) {
        throw new TypeError(errMsg(ERR_LAYER_UNDEFINED));
      }
      return clone((map) => {
        const existing = map.get(cap);
        map.set(cap, {
          augments: existing?.augments ?? [],
          argsList: [...(existing?.argsList ?? []), [...args]],
        });
      });
    },

    augment: <T extends AnyFn>(capability: Capability<T, any, any>, wrapper: AugmentWrapper<T>): Registry => {
      if (!isCapability(capability)) {
        throw new TypeError(errMsg(ERR_AUGMENT_TARGET));
      }
      if (typeof wrapper !== 'function') {
        throw new TypeError(errMsg(ERR_AUGMENT_NOT_FUNCTION));
      }
      // Dev canary: a builder-style argument (`h => h.after(fn)`) is also a unary
      // function, so it would only fail at first dispatch; probing with a noop fails
      // it here instead (wrappers are pure composition, so the probe is safe to run).
      // Inline NODE_ENV so a bundler folds the block away in prod (see errMsg in util/errors.ts).
      if (process.env.NODE_ENV !== 'production') {
        let probed: unknown;
        try {
          probed = (wrapper as unknown as AugmentWrapper)(canaryNoop);
        } catch (caught) {
          throw new TypeError(fmt(MESSAGES[ERR_AUGMENT_CANARY_THREW], { caught: String(caught) }));
        }
        if (typeof probed !== 'function') {
          throw new TypeError(fmt(MESSAGES[ERR_AUGMENT_BUILDER]));
        }
      }
      const box = [wrapper as unknown as AugmentWrapper] as const;
      return clone((map) => {
        const existing = map.get(capability);
        map.set(capability, {
          argsList: existing?.argsList,
          augments: [...(existing?.augments ?? []), box],
        });
      });
    },

    has: (capability: AnyCapability): boolean => {
      // Entries only ever come from layer/augment (registry() takes no external map).
      // Presence means any registration (a layer or an augment-only entry), so
      // presence is sufficient to confirm membership.
      return entries.get(capability) !== undefined;
    },

    bindings: (): ReadonlyMap<AnyCapability, RegistryBindingValue> => entries,
  };

  // Boundary cast: the impl stores entries identically for every capability; the
  // generic Registry<L> layer record is a type-level view the impl can't express directly.
  return Object.freeze(self) as unknown as Registry;
};

/**
 * Creates a fresh, frozen, immutable Registry. Derive with `.layer()` / `.augment()`,
 * each of which returns a new registry (clone-on-write). The registry never accepts a
 * caller-built entries map: bindings flow in only through those two methods, which keeps
 * entry shapes an internal invariant the runtime can rely on.
 *
 * Starts with an empty layer record (`readonly []`) so `.layer` chains build a precise
 * per-registry layer-record tuple; a bare `Registry` annotation widens it back to "any".
 */
export const registry = (): Registry<readonly []> => makeRegistry(new Map()) as Registry<readonly []>;
