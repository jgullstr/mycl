/**
 * @file
 * Registry composition: merge() folds an ordered registry sequence into a
 * cached ResolvedRegistry via the composite-sym trie, deduping contributions
 * shared across derived registries before handing them to the strategy fold.
 */

import type { AnyFn, AugmentWrapper } from '../util/types';
import type { AnyCapability } from '../capability/types';
import type { Registry, ResolvedRegistry } from './types';
import { foldBindings } from '../strategy/fold';
import { makeResolvedRegistry } from './resolvedRegistry';
import isResolvedRegistry from './isResolvedRegistry';
import { errMsg, ERR_MERGE_RESOLVED } from '../util/errors';

/**
 * A node in the composite-sym trie, which maps an ordered sequence of Registry
 * instances to a stable Symbol and a cached ResolvedRegistry. The trie is a
 * WeakMap chain so entries are GC-eligible when registries go out of scope.
 * Each node stores { children, sym?, resolved? } so a registry can
 * simultaneously be a prefix for longer paths and a leaf for shorter ones.
 */
interface TrieNode {
  children: WeakMap<Registry, TrieNode>;
  sym?: symbol;
  resolved?: ResolvedRegistry;
}

const EMPTY_SYM = Symbol('mycl.resolved.empty');
const trieRoot: TrieNode = { children: new WeakMap() };
const emptyNode: TrieNode = { children: new WeakMap(), sym: EMPTY_SYM };

const getTrieNode = (registries: Registry[]): TrieNode => {
  if (registries.length === 0) {
    return emptyNode;
  }
  return registries.reduce<TrieNode>((node, reg) => {
    const child = node.children.get(reg);
    if (child !== undefined) {
      return child;
    }
    const fresh: TrieNode = { children: new WeakMap() };
    node.children.set(reg, fresh);
    return fresh;
  }, trieRoot);
};

/**
 * Composes registries into a single {@link ResolvedRegistry}, the
 * dispatch-ready form a scope runs against. Later registries win per
 * capability; augments accumulate. Each capability folds via its own layer
 * strategy (default last-wins). Any registries compose; there is no
 * homogeneous constraint.
 *
 * The same registry sequence (by object identity, in order) always returns
 * the same instance.
 */
export const merge = (...registries: Registry[]): ResolvedRegistry => {
  // Dev guard: a ResolvedRegistry is opaque (no bindings to fold), so it cannot
  // be re-composed. It is accepted only as the sole scope source, where scope()
  // and mycl() pass it through without merging.
  if (process.env.NODE_ENV !== 'production') {
    for (const reg of registries) {
      if (isResolvedRegistry(reg)) {
        throw new TypeError(errMsg(ERR_MERGE_RESOLVED));
      }
    }
  }
  const node = getTrieNode(registries);
  if (node.resolved !== undefined) {
    return node.resolved;
  }

  // Snapshot the sequence: the resolver closure must not observe later caller
  // mutations of the input array. The trie keyed (and cached) the sequence as
  // it was at call time, so a shared mutable reference would poison the cache.
  const regs = registries.slice();

  const sym = node.sym ?? (node.sym = Symbol());
  const resolved = makeResolvedRegistry((capability: AnyCapability): AnyFn | null => {
    // Derived registries share inner tuple/box references (clone-on-write),
    // so the insertion-ordered Sets fold a shared contribution exactly once;
    // separate .layer()/.augment() calls stay identity-distinct and always fold.
    const argsSet = new Set<unknown[]>();
    const augmentsSet = new Set<readonly [AugmentWrapper]>();
    for (const reg of regs) {
      const entry = reg.bindings().get(capability);
      for (const args of entry?.argsList ?? []) {
        argsSet.add(args);
      }
      for (const box of entry?.augments ?? []) {
        augmentsSet.add(box);
      }
    }

    return foldBindings(capability, [{ argsList: [...argsSet], augments: [...augmentsSet] }]);
  }, sym);

  node.resolved = resolved;
  return resolved;
};
