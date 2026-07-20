/**
 * @file
 * The channel entry point: createChannel(name, connector) hands the name to the
 * connector, mints the channel token over the connector's fresh context, and returns
 * the kernel the connector builds from the surface (capable/snapshot/channel/context).
 */

import type { ChannelName, Connector } from './types';
import { resolveContext, createChannelInternal } from './slot';
import { resolveCapable } from '../capability/resolveCapable';
import { resolveSnapshot } from '../capability/resolveSnapshot';
import { errMsg, ERR_INVALID_CHANNEL_NAME } from '../util/errors';

/**
 * The channel name becomes the leading `channelName:` segment of every capability
 * identifier. Banning `:` keeps the first `:` an unambiguous delimiter, so two
 * distinct (name, path) pairs can never assemble the same identifier string or
 * type-level Id literal; `/` is reserved as the path segment separator.
 */
const CHANNEL_NAME_SEPARATOR_RE = /[:/]/;

/**
 * Creates a channel for a connector: hands `name` to the connector, mints a frozen
 * channel token over the connector's fresh context, and returns the kernel the
 * connector's `build` makes of the surface (the pre-bound capable/snapshot, the
 * token, and the live context facade). There is no connectorless form: a channel
 * always belongs to the connector that operates it, and its context never
 * escapes, so two channels cannot share a scope stack by accident.
 */
export const createChannel = <const G extends string, K>(
  name: ChannelName<G>,
  connector: Connector<G, K>,
): K => {
  if (process.env.NODE_ENV !== 'production' && CHANNEL_NAME_SEPARATOR_RE.test(name)) {
    throw new Error(errMsg(ERR_INVALID_CHANNEL_NAME, { name }));
  }
  // `name`'s declared type is ChannelName<G>, not the bare G the internals expect:
  // a clean name has ChannelName<G> = G, but TS can't see that equality structurally,
  // so without the cast it would infer downstream G positions as ChannelName<G> and
  // mismatch this function's own G. A rejected name never reaches this line (it fails
  // at the call site above), so the cast back to G is safe.
  const d = connector(name as G);
  const channel = createChannelInternal(name as G, d.context);
  return d.build({
    capable: resolveCapable(channel),
    snapshot: resolveSnapshot(channel),
    channel,
    // Forwarding facade (resolveContext): follows setChannelContext swaps.
    context: resolveContext(channel),
  });
};
