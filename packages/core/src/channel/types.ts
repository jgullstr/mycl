/**
 * @file
 * The channel subsystem's type vocabulary: the opaque Channel token shape, the
 * mutable context slot every channel carries, the name validator, the surface
 * a channel exposes, and the Connector contract that curates it.
 */

import type { AnyFn } from '../util/types';
import type { Capability, CapableConfig, IdPath, Snapshotted } from '../capability/types';
import type { ResolvedRegistry } from '../registry/types';
import type { ScopeContext } from '../context/types';
import type { CHANNEL_KEY } from './symbols';

/**
 * Opaque channel token returned by createChannel.
 * `[CHANNEL_KEY]` carries a provenance symbol: its presence proves the object came from
 * `createChannel`; the symbol is provenance only. The channel's context lives in its
 * own hidden slot (see {@link ContextSlot}).
 */
export interface Channel<G extends string = string> {
  readonly [CHANNEL_KEY]: symbol;
  readonly name: G;
}

/**
 * Mutable cell holding a channel's current context. Dispatch/snapshot capture the
 * cell (not its contents) once, then read `.current` per call, so a
 * `setChannelContext` swap is visible to already-built capabilities without any
 * per-call lookup. The cell always exists for a valid channel (it is created
 * together with the channel).
 */
export interface ContextSlot {
  current: ScopeContext<ResolvedRegistry>;
}

/**
 * Rejects a channel name containing the `:` or `/` identifier separators at the
 * type level. A conditional replacement: a clean name passes through (literal
 * inference of `G` intact), a name containing a separator is replaced by a
 * message type, so the compiler error names the offender instead of `never`.
 * Exported for connector authors: a bound channel factory's name parameter
 * uses this type so it validates and infers exactly like createChannel's.
 */
export type ChannelName<G extends string> = G extends `${string}${':' | '/'}${string}`
  ? `mycl: channel name must not contain ':' or '/', got '${G}'` : G;

/**
 * The capability constructor bound to a channel: mints capabilities that
 * dispatch through it. The mandatory non-empty `idPath` is
 * prefixed with the channel's name to form the full
 * `channelName:idPath` identifier carried in the capability's
 * type. The single canonical signature: `ChannelSurface.capable` and
 * `resolveCapable`'s return conform to it, so they cannot drift.
 */
export type Capable<G extends string> = <T extends AnyFn, V = T, Args extends unknown[] = [V], const Id extends string = string>(
  baseFn: T | Capability<T, any, any, any>,
  idPath: IdPath<Id>,
  config?: CapableConfig<T, V, Args>,
) => Capability<T, V, Args, `${G}:${Id}`>;

/**
 * The surface createChannel returns: the channel token, its context, and
 * the capability/snapshot factories pre-bound to that channel.
 */
export interface ChannelSurface<G extends string = string> {
  /**
   * Pre-bound capable: creates capabilities dispatching through this channel.
   */
  capable: Capable<G>;
  /**
   * Pre-bound snapshot: captures this channel's current scope. Compose for
   * multi-channel capture.
   */
  snapshot: <T extends AnyFn>(fn: T) => Snapshotted<T>;
  /**
   * The channel token: pass to setChannelContext or export to allow context updates.
   */
  channel: Channel<G>;
  /**
   * The channel's context: use directly when you need ctx.run (e.g. scope-style code).
   */
  context: ScopeContext<ResolvedRegistry>;
}

/**
 * The per-environment bundle passed to createChannel: receives the channel
 * name (the type-level G-carrier; also legitimately useful for diagnostics)
 * and returns the channel's fresh context together with `build`, which shapes
 * the public kernel from the surface. Core defines and invokes this contract; it
 * never implements one (the LayerStrategy precedent). Mint the context INSIDE
 * the connector: a context closed over by a connector is shared by every channel it
 * mints, collapsing their scopes into one. Dev enforces this (a context that
 * already backs another channel is rejected at createChannel/setChannelContext).
 *
 * `build` is declared in method syntax on purpose: a connector author's generic
 * `build` (over `G`) must instantiate against a fixed `G` at the call site,
 * which strict property variance would reject.
 */
export type Connector<G extends string, K> = (name: G) => {
  context: ScopeContext<ResolvedRegistry>;
  build(surface: ChannelSurface<G>): K;
};
