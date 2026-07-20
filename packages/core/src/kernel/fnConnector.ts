/**
 * @file
 * The plain-function connector: createChannel(name, fnConnector) is the whole
 * ceremony. It mints the channel over a fresh stack context (inside the
 * connector, so two channels can never share one by accident) and builds the
 * everyday kernel: the pre-bound capable/snapshot, the channel token, and
 * mycl/scope bound to it. The raw context is deliberately absent from the
 * kernel: the substrate stays private, and context swaps go through
 * setChannelContext(kernel.channel, ...).
 */

import stackContext from '../context/stack';
import type { ChannelSurface } from '../channel/types';
import type { FnKernel } from './types';
import { resolveMycl } from './resolveMycl';
import { resolveScope } from './resolveScope';

/**
 * The fn connector. Generic over the channel name so the kernel type carries the
 * literal (`createChannel('formox', fnConnector)` yields `FnKernel<'formox'>`);
 * the name parameter itself is the inference carrier and is otherwise unused.
 */
export const fnConnector = <G extends string>(_name: G) => {
  const context = stackContext();
  return {
    context,
    build: (surface: ChannelSurface<G>): FnKernel<G> => ({
      channel: surface.channel,
      capable: surface.capable,
      snapshot: surface.snapshot,
      mycl: resolveMycl(surface.channel),
      scope: resolveScope(surface.channel),
    }),
  };
};
