/**
 * @file
 * The capability type vocabulary: the Capability shape and its type
 * parameters, the config resolveCapable()/capable() accept, the dispatch cache
 * and snapshot views, and the identifier machinery (assembly, validation,
 * extraction) built on it.
 */

import type {
  CAPABILITY_BASE, CAPABILITY_CONFIG, CAPABILITY_CONTRACT,
  CAPABILITY_TAG, CAPABILITY_ID,
} from './symbols';
import type { LayerStrategy, AnyStrategy } from '../strategy/types';
import type { AnyFn, Invariant } from '../util/types';
import type { ResolvedRegistry } from '../registry/types';

/**
 * Config for resolveCapable() / capable(). `strategy` selects the merge behaviour.
 * (The identifier path is a mandatory positional argument to `capable`, not a config field.)
 * See {@link LayerStrategy} for the V-inference contract: annotate one of the
 * strategy's `acc`/`value` parameters, or provide `seed`.
 */
export interface CapableConfig<T extends AnyFn = AnyFn, V = T, Args extends unknown[] = [V]> {
  strategy?: LayerStrategy<T, V, Args>;
}

/**
 * A capability: a function that dispatches through the active scope.
 *
 * `T` is the callable signature (what users call). `V` is the value stored in
 * the registry (what `layer()` contributions accumulate into). `Args` is the
 * tuple each `layer()` call accepts. For ordinary function capabilities,
 * `V = T` and `Args = [V]`, so ignore both. For capabilities with custom merge
 * semantics (accumulating strings, collecting handlers), `V` is the
 * accumulated value type and the strategy's `extract(value, base)` turns it
 * back into a `T`. `Id` is the identifier literal
 * (`channelName:idPath`) assigned at construction.
 *
 * @see LayerStrategy for step/extract semantics.
 */
export type Capability<T extends AnyFn = AnyFn, V = T, Args extends unknown[] = [V], Id extends string = string> = T & {
  readonly [CAPABILITY_TAG]: true;
  readonly [CAPABILITY_BASE]: T;
  readonly [CAPABILITY_CONTRACT]: Invariant<[V, Args]>;
  readonly [CAPABILITY_CONFIG]?: AnyStrategy;
  // Non-optional: every capability is assigned an identifier at construction (resolveCapable.ts),
  // so the slot is always present. This also lets CapabilityId infer the literal cleanly
  // (an optional slot widens `infer Id extends string` to `string` via the `| undefined`).
  readonly [CAPABILITY_ID]: Id;
};

/**
 * The runtime-erasure view: any capability, value/identifier contracts
 * intentionally discarded.
 */
export type AnyCapability = Capability<AnyFn, any, any, string>;

/**
 * Result of `snapshot`: same call signature, `this`, params and return as T,
 * minus own properties. A generic function degrades to its
 * constraint-instantiated signature (`Parameters`/`ReturnType` cannot
 * preserve genericity).
 */
export type Snapshotted<T extends AnyFn>
  = (this: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T>;

/**
 * Per-capability dispatch cache, keyed by the resolved-registry sym when one
 * is registered, or by the ResolvedRegistry object itself otherwise. Weak
 * either way: entries die with their key.
 */
export type DispatchCache = WeakMap<symbol | ResolvedRegistry, AnyFn | null>;

/**
 * A capability's assembled identifier literal (`channelName:idPath`).
 * Matches the `[CAPABILITY_ID]` property directly rather than reconstructing
 * `Capability<any, …, infer Id>`: the `any` first type-arg would make
 * `any & {…}` collapse to `any`, leaving `infer Id` unbound.
 */
export type CapabilityId<C extends AnyCapability>
  = C extends { readonly [CAPABILITY_ID]: infer Id extends string } ? Id : never;

/**
 * The message type an empty identifier path is replaced with; the compiler
 * error quotes it verbatim.
 */
type MalformedIdPath = 'mycl: identifier path must be non-empty';

/**
 * Validates the identifier path at the type level: any non-empty literal
 * passes through unchanged; a definitely-empty one is replaced by a
 * self-describing message type, so the argument is unassignable and the
 * compiler error says why. Channels are disjoint, so uniqueness only matters
 * within one channel and any non-empty name suffices; `project/capability`
 * prefixes stay the recommended convention when several areas share a
 * channel. A non-literal `string` (an explicitly-instantiated call that lets
 * `Id` default, or a dynamic value) degrades to plain `string`, backstopped
 * by the dev-time runtime guard; NoInfer keeps the degrade branch out of
 * `Id`'s inference candidates.
 */
export type IdPath<Id extends string>
  = Id extends '' ? MalformedIdPath
    : string extends Id ? NoInfer<string>
      : Id;

/**
 * The value type `V` a capability accumulates in the registry (`T` for a
 * plain capability). Reads the invariant contract slot through a
 * `(x: never) => [V, Args]` match: `Capability<any, infer V, ...>` would
 * collapse to `any` (leaving the infer unbound), and an `any` in the match
 * position would breach the package's any-containment.
 */
export type AccumulatedValue<C extends AnyCapability>
  = C extends { readonly [CAPABILITY_CONTRACT]: (x: never) => [infer V, unknown[]] } ? V : never;

/**
 * The tuple each `layer()` call accepts for a capability (`[T]` for a plain
 * capability). Same contract-slot match as {@link AccumulatedValue}.
 */
export type LayerArgs<C extends AnyCapability>
  = C extends { readonly [CAPABILITY_CONTRACT]: (x: never) => [unknown, infer A extends unknown[]] } ? A : never;
