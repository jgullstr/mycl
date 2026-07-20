/**
 * @file
 * The channel-agnostic scope constructor: builds a scope that installs its
 * registry into one channel's context.
 */

// Deliberately imports nothing that instantiates a channel; see resolveMycl.ts for why.
import type { AnyFn } from '../util/types';
import type { Channel } from '../channel/types';
import type { Registry, ResolvedRegistry } from '../registry/types';
import type { Snapshotted } from '../capability/types';
import type { Scope } from './types';
import { resolveContext } from '../channel/slot';
import { resolveSnapshot } from '../capability/resolveSnapshot';
import { asResolvedRegistry } from './asResolvedRegistry';

/**
 * resolveScope(channel): a scope bound to one channel; mirrors resolveCapable /
 * resolveSnapshot / resolveMycl. The returned scope installs its registry into that
 * channel's context only.
 *
 * Binds a function to a registry scope.
 *   scope(fn)      → empty scope; capabilities fall back to their base implementations.
 *   scope(fn, reg) → capabilities dispatch through reg (Registry, a runtime ResolvedRegistry,
 *                    or a precomputed ResolvedRegistry; all pass through asResolvedRegistry
 *                    identically).
 *
 * Composes snapshot: pushes the resolved scope onto the channel's context, lets
 * snapshot capture it, then pops. The returned function replays that scope on every call.
 */
export const resolveScope = (channel: Channel): Scope => {
  const ctx = resolveContext(channel);
  const snapshot = resolveSnapshot(channel);
  return <T extends AnyFn>(fn: T, reg?: Registry | ResolvedRegistry): Snapshotted<T> =>
    ctx.run(asResolvedRegistry(reg), () => snapshot(fn));
};
