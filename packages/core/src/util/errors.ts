/**
 * @file
 * The coded error model: stable numeric codes, the dev message templates keyed
 * by them, and the resolvers that pick full dev text in development or a coded
 * URL message in production so a consumer's bundler can strip every dev string.
 */

/**
 * Coded production fallback: names the code and its documentation URL instead
 * of carrying the full message text.
 */
const prodMsg = (code: number): string =>
  `mycl: error ${code}, visit https://mycl.dev/errors/${code} for more information.`;

// Codes are stable once shipped: never renumber. Each code is also the path
// segment in https://mycl.dev/errors/<code>.

/**
 * A capability was called outside any registry scope.
 */
export const ERR_OUT_OF_SCOPE = 1;

/**
 * A capability resolved to a non-function value.
 */
export const ERR_NON_FUNCTION_RESOLVE = 2;

/**
 * An invalid channel token was supplied.
 */
export const ERR_INVALID_CHANNEL = 3;

/**
 * A registered symbol (Symbol.for) was used where the dispatch cache needs a
 * unique Symbol() key.
 */
export const ERR_SYMBOL_FOR_KEY = 4;

/**
 * layer() received a target that is not a capability.
 */
export const ERR_LAYER_TARGET = 5;

/**
 * layer() received an undefined value.
 */
export const ERR_LAYER_UNDEFINED = 6;

/**
 * augment() received a target that is not a capability.
 */
export const ERR_AUGMENT_TARGET = 7;

/**
 * augment() received a wrapper that is not a function.
 */
export const ERR_AUGMENT_NOT_FUNCTION = 8;

/**
 * augment() received a builder-style argument (h => …) instead of a wrapper.
 */
export const ERR_AUGMENT_BUILDER = 9;

/**
 * An augment wrapper threw during the dev canary probe.
 */
export const ERR_AUGMENT_CANARY_THREW = 10;

/**
 * An identifier path is empty (or missing, from an untyped caller).
 */
export const ERR_INVALID_IDENTITY = 11;

/**
 * A channel name contains a ":" or "/" separator.
 */
export const ERR_INVALID_CHANNEL_NAME = 12;

/**
 * Two capabilities resolve to the same identity.
 */
export const ERR_DUPLICATE_IDENTITY = 13;

/**
 * alsContext was called on a runtime without process.getBuiltinModule (Node
 * older than 20.16, or a non-Node runtime that does not provide it).
 */
export const ERR_NO_ASYNC_HOOKS = 14;

/**
 * merge() received an already-resolved registry, which cannot be re-composed.
 */
export const ERR_MERGE_RESOLVED = 15;

/**
 * A ScopeContext instance that already backs one channel was installed on
 * another; contexts are per-channel.
 */
export const ERR_CONTEXT_IN_USE = 16;

// Next new code: 17.

/**
 * Dev message templates with {placeholder} slots: the single source of truth
 * (the docs error pages are generated from this table). Referenced ONLY inside
 * inline `process.env.NODE_ENV !== 'production'` gates (errMsg here, the canary
 * in registry.ts, the duplicate check), so the whole object and every string
 * are dead-code-eliminated from a production bundle.
 */
export const MESSAGES: Record<number, string> = {
  [ERR_OUT_OF_SCOPE]: 'mycl: capability "{name}" called outside any registry scope. Wrap the call site with scope(), or use snapshot() before async boundaries.',
  [ERR_NON_FUNCTION_RESOLVE]: 'mycl: capability "{name}" resolved to a non-function value. Check your LayerStrategy.extract. It must return a function.',
  [ERR_INVALID_CHANNEL]: 'mycl: invalid channel',
  [ERR_SYMBOL_FOR_KEY]: 'mycl: registered symbol (Symbol.for) cannot key the dispatch cache — use a unique Symbol()',
  [ERR_LAYER_TARGET]: 'layer: target must be a capability',
  [ERR_LAYER_UNDEFINED]: 'layer: value cannot be undefined',
  [ERR_AUGMENT_TARGET]: 'augment: target must be a capability',
  [ERR_AUGMENT_NOT_FUNCTION]: 'augment: wrapper must be a function',
  [ERR_AUGMENT_BUILDER]: 'augment: received a builder (h => …) instead of a wrapper. Pass the wrapper directly: augment(cap, after(fn)).',
  [ERR_AUGMENT_CANARY_THREW]: 'augment: wrapper threw during canary probe — wrappers must be pure composition and not throw on application.\nCaught: {caught}',
  [ERR_INVALID_IDENTITY]: 'mycl: identifier path must be a non-empty string, got "{identity}".',
  [ERR_INVALID_CHANNEL_NAME]: 'mycl: channel name "{name}" must not contain a ":" or "/" separator.',
  [ERR_DUPLICATE_IDENTITY]: 'mycl: duplicate capability identifier "{identity}": two capabilities resolve to the same identifier. Most likely a duplicate copy of the package that creates it (nested install or dual ESM+CJS load, run pnpm dedupe); otherwise two packages collide on the same identifier path.',
  [ERR_NO_ASYNC_HOOKS]: 'mycl: alsContext requires process.getBuiltinModule (Node 20.16 or newer, or a runtime that provides it). Use stackContext for synchronous scoping, or install your own ScopeContext via setChannelContext.',
  [ERR_MERGE_RESOLVED]: 'mycl: merge() received an already-resolved registry, which cannot be re-composed. Pass it as the sole scope source instead: scope(fn, resolved) or mycl(make, resolved).',
  [ERR_CONTEXT_IN_USE]: 'mycl: this ScopeContext instance already backs channel "{name}". A context belongs to one channel (sharing one collapses their scopes); mint a fresh context per channel.',
};

/**
 * Interpolates a template's {placeholder} slots from `p`, leaving unknown
 * placeholders intact.
 */
export const fmt = (tpl: string, p: Record<string, string> = {}): string =>
  tpl.replace(/\{(\w+)\}/g, (_m, k) => (k in p ? p[k] : `{${k}}`));

/**
 * Resolve a coded error message: the full dev text in development, the coded
 * URL message in production. The NODE_ENV check is written inline in the body
 * (never hoisted to a module const) because esbuild reliably folds a literal
 * gate but does NOT consistently inline a module-local const into every one;
 * the folded dev branch takes MESSAGES and fmt with it out of a production
 * bundle.
 */
export const errMsg = (code: number, p?: Record<string, string>): string =>
  process.env.NODE_ENV !== 'production' ? fmt(MESSAGES[code], p) : prodMsg(code);
