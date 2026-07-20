/**
 * @file
 * The capability brand check: a capability is a function carrying the
 * {@link CAPABILITY_TAG} symbol.
 */

import type { AnyCapability } from './types';
import { CAPABILITY_TAG } from './symbols';

/**
 * Type guard: whether `value` is a capability (a function wrapped by
 * `capable()`). Narrows to {@link AnyCapability}.
 */
const isCapability = (value: unknown): value is AnyCapability =>
  typeof value === 'function' && CAPABILITY_TAG in value;

export default isCapability;
