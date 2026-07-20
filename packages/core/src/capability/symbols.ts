/**
 * @file
 * The capability subsystem's symbol vocabulary: every hidden property key a
 * capability carries. Whether a symbol is global (Symbol.for) or local is
 * part of the cross-copy contract, so each entry states its scope.
 */

/**
 * Brands a function as a capability. Global symbol, shared across all copies
 * of the package.
 */
export const CAPABILITY_TAG: unique symbol = Symbol.for('mycl.capability');

/**
 * Merge config attached to a capability. Local symbol.
 */
export const CAPABILITY_CONFIG: unique symbol = Symbol('mycl.capability.config');

/**
 * Base implementation of a capability. Local symbol.
 */
export const CAPABILITY_BASE: unique symbol = Symbol('mycl.capability.base');

/**
 * Invariant value-contract brand on a capability. Local symbol; phantom, never
 * read at runtime.
 */
export const CAPABILITY_CONTRACT: unique symbol = Symbol('mycl.capability.contract');

/**
 * Per-capability dispatch cache (WeakMap<symbol | ResolvedRegistry, AnyFn | null>;
 * weak keys keep entries GC-eligible with their registry). Local symbol, never
 * exported publicly.
 */
export const CAPABILITY_CACHE: unique symbol = Symbol('mycl.capability.cache');

/**
 * Assembled identity string (`channelName:idPath`) on a capability.
 * Type-level it gives the capability a unique identity (the literal); runtime it
 * stores the string, used as the error/debug label and the introspection label.
 * Local symbol, never exported publicly.
 */
export const CAPABILITY_ID: unique symbol = Symbol('mycl.capability.id');
