/**
 * @file
 * The registry-phase check: tells a composed, dispatch-ready registry apart from
 * one still being layered.
 */

import type { Registry, ResolvedRegistry } from './types';

/**
 * Type guard: whether `reg` is a composed, dispatch-ready
 * {@link ResolvedRegistry} rather than a still-layerable {@link Registry}.
 */
const isResolvedRegistry = (reg: Registry | ResolvedRegistry): reg is ResolvedRegistry =>
  'resolve' in reg;

export default isResolvedRegistry;
