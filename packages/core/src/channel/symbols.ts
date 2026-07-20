/**
 * @file
 * The channel subsystem's symbol vocabulary: the hidden property keys a
 * Channel token carries for provenance and context-slot storage.
 */

/**
 * Property key on Channel tokens; its presence proves provenance.
 * Local symbol, unforgeable.
 */
export const CHANNEL_KEY: unique symbol = Symbol('mycl.channel.key');

/**
 * Hidden mutable context slot on a Channel token (see ContextSlot for the
 * capture-once/read-per-call contract). Local symbol.
 */
export const CHANNEL_CTX_SLOT: unique symbol = Symbol('mycl.channel.ctx-slot');
