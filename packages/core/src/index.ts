/**
 * @file
 * mycl's main entry, one audience: channel users. createFnChannel(name) mints a
 * private channel with the everyday kernel bound to it; registry/requires
 * build and check the registries it dispatches through (composition is the
 * kernel's job: mycl/scope fold their variadic registries themselves); the
 * guards and setChannelContext round out the runtime. The full user type
 * vocabulary stands here too. The level above (connector authors, build
 * plugins, sibling kernels) works against @mycl/core/factory, where merge
 * lives; ScopeContext implementations live on @mycl/core/context; the wrapper
 * helpers on @mycl/core/helpers.
 */

// This entry is deliberately side-effect-free ("sideEffects": false) and
// touches no realm-global state: mycl has no ambient channel to guard, and
// duplicate copies coexist harmlessly (channels are disjoint by construction).
// A library that wants to self-report its own duplicate copies hand-rolls the
// documented recipe; mycl ships no guard.
export { createFnChannel } from './kernel/createFnChannel';
export { registry } from './registry/registry';
export { requires } from './kernel/requires';
export { setChannelContext } from './channel/slot';
export { default as isCapability } from './capability/isCapability';
export { default as isResolvedRegistry } from './registry/isResolvedRegistry';

export type { FnKernel, Requiring, RequiredIds, MyclFactory, SuppliedRegistries, Mycl, Scope } from './kernel/types';

export type { ChannelName } from './channel/types';
export type { Channel } from './channel/types';
export type { ScopeContext } from './context';
export type { LayerStrategy } from './strategy/types';
export type { AnyFn, AugmentWrapper, Transform } from './util/types';
export type {
  Capability,
  AnyCapability,
  IdPath,
  CapableConfig,
  Snapshotted,
  CapabilityId,
  AccumulatedValue,
  LayerArgs,
} from './capability/types';
export type {
  Registry,
  RegistryBindings,
  ResolvedRegistry,
  RegistryLayer,
  RegistryLayers,
  CapabilityLayers,
  ProvidedIds,
} from './registry/types';
