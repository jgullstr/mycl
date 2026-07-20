/**
 * @file
 * The strategy vocabulary: the Extractor/Step pair a capability's
 * custom merge semantics are built from, the LayerStrategy config that
 * carries them, and its type-erased runtime view.
 */

import type { AnyFn } from '../util/types';

/**
 * Builds a capability's callable T from an accumulated value V and the
 * incoming base (the prior stage's result, or the capability's base function
 * for the first stage).
 */
export type Extractor<T extends AnyFn, V> = (value: V, base: T) => T;

/**
 * Folds layer args into the accumulated value V; owns the no-prior-value case
 * via `acc: V | undefined`.
 */
export type Step<V, Args extends unknown[]> = (acc: V | undefined) => (...args: Args) => V;

/**
 * Custom merge semantics for a capability, shaped as a left fold over its
 * layer contributions: `step` is the fold function (each layer's args fold
 * into the value V), `seed` the optional initial accumulator, and `extract`
 * the final projection of V into a callable T. Left-fold shape is what makes
 * registries composable for the capability: layers from composed registries
 * fold as one sequence, so contributors never coordinate.
 *
 * Inference contract: `V` cannot be inferred from context-sensitive function
 * bodies alone, so give it one non-deferred source: annotate `step`'s
 * `acc` parameter, annotate `extract`'s `value` parameter, or provide
 * `seed`. With none of the three, `V` silently falls back to its default
 * (`T`) and the strategy's properties error against the wrong type.
 */
export interface LayerStrategy<T extends AnyFn, V, Args extends unknown[] = [V]> {
  extract: Extractor<T, V>;
  step: Step<V, Args>;
  seed?: V;
}

/**
 * The runtime view of a strategy after type erasure: `LayerStrategy` at its
 * top types.
 */
export type AnyStrategy = LayerStrategy<AnyFn, unknown, unknown[]>;
