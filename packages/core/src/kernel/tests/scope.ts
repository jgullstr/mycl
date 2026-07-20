/**
 * @file
 * The default scope: the channel-agnostic binder pre-bound to the fn kernel's
 * channel, alongside a re-export of the constructor itself.
 */

import type { Scope } from '../types';
import { resolveScope } from '../resolveScope';
import { FN_CHANNEL } from './defaultContext';

/**
 * The channel-bound constructor behind {@link scope}; pass another channel to build
 * a scope on its channel instead.
 */
export { resolveScope } from '../resolveScope';

/**
 * The default scope: resolveScope bound to the fn kernel's channel, so bound functions
 * replay their registries on the 'mycl.fn' channel.
 */
export const scope: Scope = resolveScope(FN_CHANNEL);
