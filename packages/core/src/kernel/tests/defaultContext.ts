/**
 * @file
 * Test-only fixture: a stand-in default kernel on the 'mycl.fn' channel; mycl
 * ships no default kernel (embedded-only). It shows how a consumer wires a
 * channel and lets the mechanism tests drive one concrete channel. Created over
 * a fresh stack context, exposing its minting/binding pair, channel handle, and
 * context.
 */

import { createChannel } from '@mycl/core/factory';
import { stackContext } from '@mycl/core/context';
import type { ChannelSurface } from '@mycl/core/factory';

/**
 * The default kernel's surface: `capable` mints and `snapshot` binds on the
 * 'mycl.fn' channel, `FN_CHANNEL` is the channel handle (feed it to resolveMycl and
 * resolveScope), and `defaultContext` is the channel's scope context. Wired through
 * an identity connector so the fixture keeps the raw base kernel (context
 * included) that the mechanism tests drive.
 */
export const {
  capable,
  snapshot,
  channel: FN_CHANNEL,
  context: defaultContext,
} = createChannel('mycl.fn', (_n: 'mycl.fn') => ({
  context: stackContext(),
  build: (base: ChannelSurface<'mycl.fn'>) => base,
}));

/**
 * Default export mirrors the named {@link defaultContext}.
 */
export default defaultContext;
