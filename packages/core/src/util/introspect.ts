/**
 * @file
 * Pure, read-only introspection over an (immutable) registry. None of these
 * invoke a capability or mutate anything: they describe a registry's bindings
 * and what a capability would resolve to, computed from the same RegistryBindingValue
 * shape dispatch reads. Shipped on the `@mycl/core/introspect` subpath so they
 * stay out of the core critical-path bundle.
 */

import type { AnyCapability } from '../capability/types';
import type { Registry, RegistryBindingValue } from '../registry/types';
import { CAPABILITY_CONFIG, CAPABILITY_ID } from '../capability/symbols';

/**
 * Whether a capability merges via the implicit last-wins default or a custom
 * LayerStrategy.
 */
export type StrategyKind = 'last-wins' | 'custom';

/**
 * One row of {@link describe}: a capability a registry binds.
 */
export interface CapabilityDescription {
  identity: string;
  /**
   * Number of `.layer(cap, …)` contributions recorded for this capability.
   */
  layers: number;
  /**
   * Number of `.augment(cap, …)` wrappers recorded for this capability.
   */
  augments: number;
  strategy: StrategyKind;
}

/**
 * Result of {@link explain}: what a capability resolves to under a registry,
 * without invoking it.
 */
export interface Explanation extends CapabilityDescription {
  /**
   * Whether the registry carries any contribution (layer or augment) for this capability.
   */
  bound: boolean;
  /**
   * True when nothing is bound, so dispatch falls through to the capability's base.
   */
  resolvesToBase: boolean;
}

/**
 * Result of {@link diff}: capability identities added / removed / changed
 * between two registries.
 */
export interface RegistryDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

const identityOf = (cap: AnyCapability): string => cap[CAPABILITY_ID];
const strategyOf = (cap: AnyCapability): StrategyKind =>
  cap[CAPABILITY_CONFIG] !== undefined ? 'custom' : 'last-wins';
const layersOf = (entry: RegistryBindingValue | undefined): number => entry?.argsList?.length ?? 0;
const augmentsOf = (entry: RegistryBindingValue | undefined): number => entry?.augments.length ?? 0;

/**
 * Lists every capability a registry binds, with its layer/augment counts and
 * strategy kind.
 */
export const describe = (reg: Registry): CapabilityDescription[] => {
  const rows: CapabilityDescription[] = [];
  for (const [cap, entry] of reg.bindings()) {
    rows.push({ identity: identityOf(cap), layers: layersOf(entry), augments: augmentsOf(entry), strategy: strategyOf(cap) });
  }
  return rows;
};

/**
 * Explains what `cap` resolves to under `reg` (base vs. how many
 * layers/augments) without invoking it.
 */
export const explain = (reg: Registry, cap: AnyCapability): Explanation => {
  const entry = reg.bindings().get(cap);
  const layers = layersOf(entry);
  const augments = augmentsOf(entry);
  return {
    identity: identityOf(cap),
    layers,
    augments,
    strategy: strategyOf(cap),
    bound: entry !== undefined,
    resolvesToBase: layers === 0 && augments === 0,
  };
};

/**
 * Compares two registries by capability identity. `changed` is detected by a
 * structural signature (layer count + augment count): it catches added/removed
 * contributions, not a changed *value* at the same count (that would need deep
 * arg comparison).
 */
export const diff = (regA: Registry, regB: Registry): RegistryDiff => {
  const sig = (reg: Registry): Map<string, string> => {
    const m = new Map<string, string>();
    for (const [cap, entry] of reg.bindings()) {
      m.set(identityOf(cap), `${layersOf(entry)}:${augmentsOf(entry)}`);
    }
    return m;
  };
  const a = sig(regA);
  const b = sig(regB);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [id, bSig] of b) {
    const aSig = a.get(id);
    if (aSig === undefined) {
      added.push(id);
    } else if (aSig !== bSig) {
      changed.push(id);
    }
  }
  for (const id of a.keys()) {
    if (!b.has(id)) {
      removed.push(id);
    }
  }
  return { added, removed, changed };
};
