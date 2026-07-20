/**
 * @file
 * The default mycl: the channel-agnostic constructor pre-bound to the fn kernel's
 * channel, alongside a re-export of the constructor itself.
 */

import { resolveMycl } from '../resolveMycl';
import { FN_CHANNEL } from './defaultContext';

/**
 * The channel-bound constructor behind {@link mycl}; pass another channel to build
 * a mycl on its channel instead.
 */
export { resolveMycl } from '../resolveMycl';

/**
 * The default mycl: resolveMycl bound to the fn kernel's channel, so its factories
 * install their registries on the 'mycl.fn' channel.
 */
export const mycl = resolveMycl(FN_CHANNEL);

/**
 * Default export mirrors the named {@link mycl}.
 */
export default mycl;
