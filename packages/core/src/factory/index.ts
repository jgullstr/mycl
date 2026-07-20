/**
 * @file
 * The level above: the contract for connector authors, build plugins, and
 * sibling runtimes built on the substrate. createChannel mints a channel for a
 * connector; merge composes registries into the ResolvedRegistry a context
 * runs; foldBindings/resolveSnapshot/resolveContext/defineInternal are the
 * composition internals such a runtime needs to fold binding values, capture
 * scope, and stamp hidden slots. The everyday user runtime (registry,
 * createFnChannel, requires, the guards) lives on the main entry @mycl/core;
 * one address per export: channel users compose by passing registries to
 * mycl/scope, which call merge internally. A precomputed registry is a plain
 * frozen ResolvedRegistry (e.g. an eager WeakMap fold via foldBindings).
 */

export { createChannel } from '../channel/createChannel';
export { merge } from '../registry/merge';
export { foldBindings } from '../strategy/fold';
export { resolveSnapshot } from '../capability/resolveSnapshot';
export { resolveContext } from '../channel/slot';
export { defineInternal } from '../util/defineInternal';

export type { Connector, ChannelSurface } from '../channel/types';
