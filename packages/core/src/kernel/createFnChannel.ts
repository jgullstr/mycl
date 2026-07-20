/**
 * @file
 * The bound channel factory: fn's connector applied to createChannel, spelled
 * out because TypeScript cannot type the point-free partial application
 * without losing name-literal inference. One import, one call: userland's
 * entire ceremony. Connector authors export exactly this shape for their own
 * connectors.
 */

import { createChannel } from '../channel/createChannel';
import type { ChannelName } from '../channel/types';
import { fnConnector } from './fnConnector';
import type { FnKernel } from './types';

/**
 * Mint a mycl channel: a private namespace with the everyday kernel bound to
 * it ({ channel, capable, snapshot, mycl, scope }). Each call mints a fresh,
 * isolated channel; the name becomes the identifier prefix of every capability
 * minted through the kernel's capable.
 */
export const createFnChannel = <const G extends string>(name: ChannelName<G>): FnKernel<G> =>
  createChannel(name, fnConnector);
