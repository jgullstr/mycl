/**
 * @file
 * The package's cross-cutting primitives: the function/invariant/wrapper
 * vocabulary every subsystem builds on. Capability, registry, channel, and
 * strategy types live in their own subsystem's types.ts.
 */

/**
 * Any function: params stay `any[]` so every function satisfies the
 * constraint; return is `unknown` to stop leakage.
 */
export type AnyFn = (...args: any[]) => unknown;

/**
 * Invariant phantom marker: X appears in both − and + position, forcing
 * nominal identity.
 */
export type Invariant<X> = (x: X) => X;

/**
 * Wraps a capability's function in another of the same signature: the unit
 * `.augment()` composes (outer wraps inner wraps base).
 */
export type AugmentWrapper<F extends AnyFn = AnyFn> = (next: F) => F;

/**
 * A single transformer in a pipe chain: maps the capability's result to a new
 * result.
 */
export type Transform<T extends AnyFn> = (value: ReturnType<T>) => ReturnType<T>;
