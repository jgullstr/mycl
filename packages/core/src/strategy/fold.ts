/**
 * @file
 * The strategy fold: the single place a capability's binding-value stream is
 * left-folded into its dispatch function, shared by the runtime merge path and
 * the eager one-pass lookup path so the two can never diverge.
 */

import type { AnyFn, AugmentWrapper } from '../util/types';
import type { AnyCapability } from '../capability/types';
import type { RegistryBindingValue } from '../registry/types';
import type { Step, Extractor, AnyStrategy } from './types';
import { CAPABILITY_BASE, CAPABILITY_CONFIG } from '../capability/symbols';

/**
 * A capability's strategy with defaults filled in.
 */
interface ResolvedStrategy {
  step: Step<unknown, unknown[]>;
  extract: Extractor<AnyFn, unknown>;
  seed: unknown;
}

/**
 * Last-wins accumulation: the implicit default for capabilities with no strategy.
 */
const DEFAULT_STEP: Step<unknown, unknown[]> = () => (child) => child;

/**
 * Identity assembly: the implicit default for capabilities with no strategy.
 */
const DEFAULT_EXTRACT: Extractor<AnyFn, unknown> = (fn) => fn as AnyFn;

const resolve = (strat: AnyStrategy | undefined): ResolvedStrategy => ({
  step: strat?.step ?? DEFAULT_STEP,
  extract: strat?.extract ?? DEFAULT_EXTRACT,
  seed: strat?.seed,
});

/**
 * Whether a contribution's args are a valid layer() input for this capability.
 * A capability with no custom strategy uses the default last-wins shape: exactly
 * [value], non-undefined (undefined would silently resolve to base). A capability
 * with its own strategy owns its Args: zero args and undefined are the strategy's
 * to interpret.
 */
export const isValidLayer = (cap: AnyCapability, args: unknown[]): boolean =>
  cap[CAPABILITY_CONFIG] !== undefined || (args.length > 0 && args[0] !== undefined);

/**
 * Folds a capability's binding-value stream into its dispatch function (null = use base),
 * applying the capability's strategy. THE single place the fold lives: both the runtime
 * path (merge, after it dedups its registry sequence into one collected binding value)
 * and the eager path (a precomputed binding value, already canonical, folded in one pass
 * via this same export from `@mycl/core/factory`) route through it, so the two can never
 * compute a capability differently.
 *
 * Entries carry the stored binding-value shape (augments boxed as single-element tuples,
 * unboxed here per augment): per entry, argsList tuples fold left-to-right through the
 * strategy's step and augments collect in order; the same holds across entries, so entry
 * boundaries do not affect the result.
 */
export const foldBindings = (cap: AnyCapability, entries: Iterable<RegistryBindingValue>): AnyFn | null => {
  const strategy = resolve(cap[CAPABILITY_CONFIG]);

  const augments: AugmentWrapper[] = [];
  // The layer fold runs inline as the entries stream by: `folded` threads the
  // accumulator, seeded once. `seed` is the fold seed (so a reducer-style step
  // can fold into an object/array without an undefined check), NOT a trigger:
  // with no layers the base passes through even when a `seed` is declared,
  // which is what `hasLayers` tracks.
  let folded: unknown = strategy.seed;
  let hasLayers = false;
  for (const entry of entries) {
    if (entry.argsList !== undefined) {
      for (const args of entry.argsList) {
        folded = strategy.step(folded)(...args);
        hasLayers = true;
      }
    }
    for (const box of entry.augments) {
      augments.push(box[0]);
    }
  }

  const base = cap[CAPABILITY_BASE];
  const applyAugments = (fn: AnyFn): AnyFn => augments.reduce((acc, w) => w(acc), fn);

  // No layers, or step folded to nothing → base passes through (null = dispatch's
  // use-base fast path).
  if (!hasLayers || folded === undefined) {
    return augments.length > 0 ? applyAugments(base) : null;
  }
  return applyAugments(strategy.extract(folded, base));
};
