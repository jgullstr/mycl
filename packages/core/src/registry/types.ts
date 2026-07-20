/**
 * @file
 * The registry type vocabulary: the layerable Registry surface,
 * its RegistryBindingValue/RegistryBindings storage shape, the type-level layer
 * record (RegistryLayer/RegistryLayers/CapabilityLayers/ProvidedIds), and the
 * resolved-registry dispatch types (Resolver/ResolvedRegistry).
 */

import type { AnyFn, AugmentWrapper } from '../util/types';
import type { Capability, AnyCapability, CapabilityId } from '../capability/types';

/**
 * A registry's stored binding value for one capability: the layer args it has
 * accumulated and the augment wrappers applied over them. The strategy fold
 * consumes this stored shape directly (augments boxed), unboxing per augment
 * in its own loop.
 */
export interface RegistryBindingValue {
  argsList?: unknown[][];
  /**
   * Each .augment() call wraps the wrapper in a fresh single-element tuple.
   * Tuple identity is shared across clone-on-write derived registries, so
   * merge can dedup inherited contributions by reference without collapsing
   * intentional repetition.
   */
  augments: ReadonlyArray<readonly [AugmentWrapper]>;
}

/**
 * The capability→binding-value map a registry stores.
 */
export type RegistryBindings = ReadonlyMap<AnyCapability, RegistryBindingValue>;

/**
 * One layer recorded in a registry's type-level layer record.
 */
export type RegistryLayer = { cap: AnyCapability; args: readonly unknown[] };

/**
 * The type-level layer record of a registry (its inspectable layers, in order).
 */
export type RegistryLayers<R> = R extends Registry<infer L> ? L : never;

/**
 * Layer records projected onto a specific capability. The capability's
 * identifier literal (its 4th type param) discriminates it from same-shaped
 * capabilities.
 */
export type CapabilityLayers<L extends readonly RegistryLayer[], C extends AnyCapability>
  = L[number] extends infer E
    ? (E extends { cap: infer EC } ? (EC extends C ? E : never) : never)
    : never;

/**
 * The union of capability identifiers a registry provides, read off its
 * type-level layer record. Distributes over a union of registries, so
 * `ProvidedIds<RegA | RegB>` unions both.
 */
export type ProvidedIds<R> = R extends Registry<infer L> ? CapabilityId<L[number]['cap']> : never;

/**
 * An immutable binding map from capability to its binding value. `layer` and
 * `augment` derive a new registry (clone-on-write); `L` is the type-level
 * layer record listing every layer, in order.
 */
export interface Registry<L extends readonly RegistryLayer[] = readonly RegistryLayer[]> {
  // Args is inferred via the capability's own type params (concrete), not via a wide
  // AnyCapability, which keeps arg-checking strict; `const A extends Args` captures the
  // literal call args for the layer record. Every capability carries an identifier, so
  // every layer is recorded: the layer record is total.
  layer<T extends AnyFn, V, Args extends unknown[], Id extends string, const A extends Args>(
    cap: Capability<T, V, Args, Id>, ...args: A
  ): Registry<readonly [...L, { cap: Capability<T, V, Args, Id>; args: A }]>;
  /**
   * Records a wrapper over whatever `cap` resolves to. An augment decorates;
   * it does not provide an implementation, so it is not recorded in the
   * type-level manifest and does not satisfy a `requires` declaration.
   */
  augment<T extends AnyFn>(cap: Capability<T, any, any, any>, wrapper: AugmentWrapper<T>): Registry<L>;
  has(cap: AnyCapability): boolean;
  bindings(): RegistryBindings;
}

/**
 * The function a ResolvedRegistry uses to dispatch a capability (returns null = use base).
 * Must return the same result for the same capability for the lifetime of the
 * ResolvedRegistry: the dispatch cache assumes this. Construct a new ResolvedRegistry
 * if your bindings change.
 */
export type Resolver = (capability: AnyCapability) => AnyFn | null;

/**
 * A registry collapsed to its dispatch function: the shape scopes carry and
 * dispatch reads.
 */
export interface ResolvedRegistry {
  resolve: Resolver;
}
