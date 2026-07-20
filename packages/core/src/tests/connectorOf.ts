/**
 * @file
 * Test helper: an identity connector over a caller-supplied context instance, so
 * suites that exercise a specific context (scopeless, ALS-like, spies) keep
 * their context inline while satisfying createChannel's connector contract.
 */

import type { ChannelSurface } from '../channel/types';
import type { ScopeContext } from '../context/types';
import type { ResolvedRegistry } from '../registry/types';

export const connectorOf = (ctx: ScopeContext<ResolvedRegistry>) =>
  <G extends string>(_name: G) => ({
    context: ctx,
    build: (base: ChannelSurface<G>) => base,
  });
