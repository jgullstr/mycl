/**
 * @file
 * The channel-agnostic mycl constructor: builds a mycl whose factories install
 * their resolved registries into one channel's context.
 */

// Deliberately imports nothing that instantiates a channel: this module is the
// channel-agnostic mechanism the package entry ships (embedded-only), so it must
// stay free of any concrete channel a consumer did not wire itself.
import type { Channel } from '../channel/types';
import type { Registry } from '../registry/types';
import type { Mycl, MyclFactoryMeta } from './types';
import { MYCL_META } from './constants';
import { resolveContext } from '../channel/slot';
import { defineInternal } from '../util/defineInternal';
import { merge } from '../registry/merge';
import { asResolvedRegistry } from './asResolvedRegistry';

/**
 * Detects the MYCL_META brand, distinguishing an extendable mycl factory from
 * a plain make function.
 */
export const isMyclFactory = (v: unknown): v is { readonly [MYCL_META]: MyclFactoryMeta } =>
  typeof v === 'function' && MYCL_META in v;

/**
 * resolveMycl(channel): a mycl bound to one channel. Each factory it creates
 * installs its resolved registries into that channel's context; capabilities minted
 * for other channels keep reading their own channels, untouched. The per-call
 * configuration IS the choice of which mycl you call; this mirrors resolveCapable
 * and resolveSnapshot.
 *
 * mycl(make, ...regs) returns a frozen callable factory. Calling it runs
 * `make(...args)` inside the resolved registry scope and returns the result
 * verbatim: mycl does not inspect, walk, scope-bind, or freeze it. Functions
 * that are invoked after the constructor returns must be wrapped in the channel's
 * snapshot() inside the constructor, where the resolved scope is active.
 *
 * Passing a branded factory back in extends it: its stored registries are
 * merged ahead of the newly-passed ones, then a fresh factory is built on the
 * factory's STORED channel, not the extender's. The factory's capabilities were
 * minted for that channel; installing the bindings anywhere else would put them
 * where dispatch can't see them.
 */
export const resolveMycl = (channel: Channel): Mycl => {
  // Validates provenance eagerly (resolveContext asserts) and captures the facade once.
  const boundCtx = resolveContext(channel);
  return ((
    fnOrFactory: ((...args: any[]) => unknown) | { readonly [MYCL_META]: MyclFactoryMeta },
    ...registries: Registry[]
  ): any => {
    // Normalize both call shapes to one meta: a branded factory arrives with its
    // stored meta (extension keeps the STORED channel; its capabilities were
    // minted for it), a plain make starts fresh on this mycl's channel.
    const meta = isMyclFactory(fnOrFactory)
      ? fnOrFactory[MYCL_META]
      : { make: fnOrFactory as (...args: any[]) => unknown, registries: [] as readonly Registry[], channel };
    const allRegs = [...meta.registries, ...registries];
    const ctx = meta.channel === channel ? boundCtx : resolveContext(meta.channel);

    // A single source routes through asResolvedRegistry so a precomputed registry
    // (a plain ResolvedRegistry) resolves the same way it does in scope().
    // Multiple registries fold via merge(); zero registries → merge() === EMPTY.
    const resolved = allRegs.length === 1 ? asResolvedRegistry(allRegs[0]) : merge(...allRegs);
    const binding = (...args: any[]) => ctx.run(resolved, () => meta.make(...args));
    defineInternal(binding, MYCL_META, { make: meta.make, registries: allRegs, channel: meta.channel } satisfies MyclFactoryMeta);
    return Object.freeze(binding);
  }) as Mycl;
};
