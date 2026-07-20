/**
 * @file
 * Channel context plumbing: every channel carries a mutable context slot created
 * together with it. Dispatch and snapshot capture the slot once and read
 * `.current` per call, so a setChannelContext swap reaches capabilities that were
 * built before it.
 */

import type { Channel, ContextSlot } from './types';
import type { ResolvedRegistry } from '../registry/types';
import type { ScopeContext } from '../context/types';
import { CHANNEL_KEY, CHANNEL_CTX_SLOT } from './symbols';
import { defineInternal } from '../util/defineInternal';
import { errMsg, ERR_INVALID_CHANNEL, ERR_CONTEXT_IN_USE } from '../util/errors';

interface ChannelWithSlot extends Channel {
  readonly [CHANNEL_CTX_SLOT]: ContextSlot;
}

/**
 * Whether `channel` carries the provenance key: the single channel-validity predicate.
 * Guards `typeof` first so a non-object (undefined/null/string from an untyped or
 * JS consumer) is handled cleanly, not via a raw `'in' operator` TypeError.
 */
const isChannel = (channel: unknown): channel is Channel =>
  channel !== null && typeof channel === 'object' && CHANNEL_KEY in channel;

// Dev-only ownership ledger: a ScopeContext instance belongs to the first
// channel it backs. Module-level but referenced only inside dev gates, so a
// production bundler drops it (same pattern as the duplicate-identifier ledger).
const contextOwners = new WeakMap<ScopeContext<ResolvedRegistry>, Channel>();

/**
 * Dev guard: sharing one context across channels merges their scope universes
 * (scope bleed, silent dispatch instead of the loud out-of-scope error), so a
 * context that already backs a different channel is rejected. Re-installing on
 * the same channel is fine.
 */
const assertUnsharedContext = (channel: Channel, ctx: ScopeContext<ResolvedRegistry>): void => {
  const owner = contextOwners.get(ctx);
  if (owner !== undefined && owner !== channel) {
    throw new TypeError(errMsg(ERR_CONTEXT_IN_USE, { name: owner.name }));
  }
  contextOwners.set(ctx, channel);
};

/**
 * Creates a channel object carrying its context slot. Internal: createChannel.ts is the
 * only caller.
 */
export const createChannelInternal = <G extends string>(
  name: G,
  rawCtx: ScopeContext<ResolvedRegistry>,
): Channel<G> => {
  const channelObj = { [CHANNEL_KEY]: Symbol(name), name } as Channel<G>;
  if (process.env.NODE_ENV !== 'production') {
    assertUnsharedContext(channelObj, rawCtx);
  }
  // The slot property is non-writable, but the cell it points to is mutable, so
  // setChannelContext can swap `.current` even though the channel itself is frozen.
  defineInternal(channelObj, CHANNEL_CTX_SLOT, { current: rawCtx } satisfies ContextSlot);
  return Object.freeze(channelObj);
};

/**
 * Throws unless `channel` is a valid channel: the throwing policy over
 * {@link isChannel}.
 */
export const assertChannel = (channel: Channel): void => {
  if (!isChannel(channel)) {
    throw new Error(errMsg(ERR_INVALID_CHANNEL));
  }
};

/**
 * Returns the channel's context slot after validating provenance. A valid
 * channel always has a slot (created with it), so there is no "context missing"
 * failure mode here, only the `invalid channel` guard.
 */
export const getChannelSlot = (channel: Channel): ContextSlot => {
  assertChannel(channel);
  return (channel as ChannelWithSlot)[CHANNEL_CTX_SLOT];
};

/**
 * Swaps the context backing `channel`, in place: capabilities and snapshots
 * already built from the channel follow the swap on their next call. A context
 * instance belongs to one channel; installing one that already backs another
 * channel throws in dev (sharing a context would merge the channels' scopes).
 */
export const setChannelContext = (
  channel: Channel,
  rawCtx: ScopeContext<ResolvedRegistry>,
): void => {
  const slot = getChannelSlot(channel);
  if (process.env.NODE_ENV !== 'production') {
    assertUnsharedContext(channel, rawCtx);
  }
  slot.current = rawCtx;
};

/**
 * Returns a live facade over `channel`'s context, for kernel authors who hold
 * only the channel token: the facade follows {@link setChannelContext} swaps
 * made after it was created. `createChannel` builds the surface's `context`
 * field through this.
 */
export const resolveContext = (channel: Channel): ScopeContext<ResolvedRegistry> => {
  const slot = getChannelSlot(channel);
  return {
    get: () => slot.current.get(),
    run: (value, fn) => slot.current.run(value, fn),
  };
};
