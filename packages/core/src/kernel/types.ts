/**
 * @file
 * The fn vocabulary: the factory brand's metadata, the factory type and its
 * readers, and the mycl() and scope() call signatures.
 */

import type { AnyFn } from '../util/types';
import type { Capable, Channel, ChannelSurface } from '../channel/types';
import type { ProvidedIds, Registry, ResolvedRegistry } from '../registry/types';
import type { Snapshotted } from '../capability/types';
import type { MYCL_META } from './constants';

/**
 * Metadata on a MyclFactory, used by mycl(factory, ...regs) to extend.
 * `make` is the user's constructor; named to avoid shadowing
 * Object.prototype.constructor (a property literally named `constructor` reads
 * like reflection in debuggers and reviews).
 *
 * `make`'s `T`/`Args` are intentionally erased here (`(...args: any[]) => unknown`):
 * they are already carried by MyclFactory's call signature, and recovering them
 * here would cascade a second copy through `[MYCL_META]`. `Regs` is NOT erased:
 * `registries` is the factory's real stored tuple, and typing it precisely is what
 * lets consumers read the manifest off a factory (see {@link SuppliedRegistries}).
 */
export interface MyclFactoryMeta<Regs extends readonly Registry[] = readonly Registry[]> {
  make: (...args: any[]) => unknown;
  registries: Regs;
  /**
   * The channel the factory was created on. Extension inherits it (see resolveMycl):
   * the factory's capabilities were minted for this channel, so re-running `make`
   * on the extender's channel would install the bindings where they can't be seen.
   */
  channel: Channel;
}

/**
 * A mycl factory: a callable produced by mycl(make, ...regs). Each call runs
 * `make` inside the resolved scope and returns the result verbatim. Pass it
 * back into mycl(factory, ...regs) to extend with more registries.
 *
 * `Regs` is the stored registry tuple; mycl() threads it so the factory type
 * loses nothing the call site knew. Read it back with {@link SuppliedRegistries}.
 */
export type MyclFactory<
  T = unknown,
  Args extends any[] = any[],
  Regs extends readonly Registry[] = readonly Registry[],
> = ((...args: Args) => T) & {
  readonly [MYCL_META]: MyclFactoryMeta<Regs>;
};

/**
 * The registry tuple a mycl factory was built over (`never` for a non-factory).
 * The single reader off a factory type; compose with the core readers for
 * everything else: `RegistryLayers<SuppliedRegistries<F>[number]>` for the combined
 * layer record (feed it to `CapabilityLayers` to project layered entries),
 * `ProvidedIds<SuppliedRegistries<F>[number]>` for the provided identifiers.
 */
export type SuppliedRegistries<F>
  = F extends { readonly [MYCL_META]: MyclFactoryMeta<infer Regs> } ? Regs : never;

/**
 * The stored tuple when extending a factory; empty when creating from a plain make.
 */
type StoredRegs<F>
  = F extends { readonly [MYCL_META]: MyclFactoryMeta<infer Regs> } ? Regs : readonly [];

/**
 * A registry is missing a required capability: surfaced as the expected
 * rest-param type so the real registry arguments are unassignable and the
 * compiler names the missing identifier.
 */
export type MissingCapabilities<M extends string>
  = `mycl: registry is missing required capability: ${M}`;

/**
 * The mycl() function signature. One overload: a MyclFactory is structurally a
 * (...args) => T, so passing one back matches the same overload. Extension is
 * detected at runtime via the MYCL_META brand, which merges stored registries.
 *
 * Provider-completeness: the required set tagged on `make` by `requires(...)`
 * (`RequiredIds<F>`, `never` when unwrapped) must be covered by the identifiers the passed
 * registries provide (`ProvidedIds<Regs[number]>`). When some are missing, the rest-param's
 * expected type becomes a `MissingCapabilities<...>` tuple, so the call fails and names them.
 * `const Regs` preserves each registry's layer record `L` so `ProvidedIds` can read it.
 */
export interface Mycl {
  <F extends AnyFn, const Regs extends readonly Registry[]>(
    make: F,
    ...registries: [Exclude<RequiredIds<F>, ProvidedIds<Regs[number]>>] extends [never]
      ? Regs
      : readonly [MissingCapabilities<Exclude<RequiredIds<F>, ProvidedIds<Regs[number]>>>]
  ): MyclFactory<ReturnType<F>, Parameters<F>, readonly [...StoredRegs<F>, ...Regs]>;
}

/**
 * The scope() function signature: binds a function to a registry scope on the
 * bound channel.
 */
export type Scope = {
  <T extends AnyFn>(fn: T): Snapshotted<T>;
  <T extends AnyFn>(fn: T, reg: Registry | ResolvedRegistry): Snapshotted<T>;
};

/**
 * Phantom brand key carrying an entry function's required capability-identifier
 * set. Internal: never set at runtime; read only at the type level by `mycl`.
 * Not a capability identifier (it distinguishes the brand slot, nothing more).
 */
declare const REQUIRES: unique symbol;

/**
 * A make function tagged with the union `R` of capability identifiers it requires.
 */
export type Requiring<F extends AnyFn, R extends string> = F & { readonly [REQUIRES]: R };

/**
 * The required identifier set tagged on a make function: `never` for an unwrapped
 * make, so a bare `mycl(make, reg)` (no `requires`) has no requirements and is
 * unchecked.
 */
export type RequiredIds<F> = F extends { readonly [REQUIRES]: infer R extends string } ? R : never;

/**
 * The kernel fnConnector builds: the channel-bound everyday surface, without the
 * raw context.
 */
export interface FnKernel<G extends string> {
  channel: Channel<G>;
  capable: Capable<G>;
  snapshot: ChannelSurface<G>['snapshot'];
  mycl: Mycl;
  scope: Scope;
}
