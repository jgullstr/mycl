/**
 * @file
 * The factory brand: the symbol that marks a callable as a mycl factory.
 */

/**
 * Tags a {@link MyclFactory} with its constructor and registries, enabling
 * extension via mycl(factory, ...regs).
 */
export const MYCL_META: unique symbol = Symbol('mycl.meta');
