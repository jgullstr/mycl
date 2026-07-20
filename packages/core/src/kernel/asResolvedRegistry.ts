/**
 * @file
 * The shared scope-source resolver: normalizes everything a caller may pass as
 * a scope source (nothing, a Registry, or a ResolvedRegistry) into one
 * ResolvedRegistry.
 */

import type { Registry, ResolvedRegistry } from '../registry/types';
import isResolvedRegistry from '../registry/isResolvedRegistry';
import { merge } from '../registry/merge';

const EMPTY: ResolvedRegistry = merge();

/**
 * Resolves ONE scope source to a ResolvedRegistry. Shared by scope() and the
 * single-source case of mycl():
 *   undefined         → EMPTY (capabilities fall back to base)
 *   ResolvedRegistry  → passthrough (covers both a runtime merge() result and
 *                       a precomputed, eagerly-folded ResolvedRegistry)
 *   Registry          → merge(reg)
 */
export const asResolvedRegistry = (reg?: Registry | ResolvedRegistry): ResolvedRegistry => {
  if (reg === undefined) {
    return EMPTY;
  }

  return isResolvedRegistry(reg) ? reg : merge(reg);
};
