/**
 * @file
 * The provider-completeness seam: a type-level tag declaring which capability
 * identifiers a make function requires its registry to provide.
 */

import type { AnyFn } from '../util/types';
import type { AnyCapability, CapabilityId } from '../capability/types';
import type { Requiring } from './types';

/**
 * Declare the capabilities an entry function requires its registry to provide.
 *
 * `requires(db, currentUser)(make)` returns `make` unchanged at runtime, tagging its *type*
 * with the union of the capabilities' identifiers (e.g. `'app:demo/db' | 'app:demo/currentUser'`).
 * `mycl(make, reg)` then type-errors unless `reg` provides every tagged identifier, naming any
 * that are missing.
 *
 * Optional and backward-compatible: a make passed to `mycl` without `requires` has an empty
 * required set and is not checked. Intended for required-effect seams (capabilities whose base
 * throws/stubs); enrichment capabilities with a usable base need not be listed.
 *
 * The check reads the registry's type-level layer record, so it degrades to
 * unchecked (fail-open) when a registry's type has been widened to a bare
 * `Registry` by an explicit annotation or a non-generic helper: a widened
 * layer record provides `string`, which covers every requirement. Keep registries
 * inferred, or thread them through generics, to keep the check live; a missed
 * requirement still fails loud at runtime via the capability's throwing base.
 */
export const requires
  = <const Caps extends readonly AnyCapability[]>(..._caps: Caps) =>
    <F extends AnyFn>(make: F): Requiring<F, CapabilityId<Caps[number]>> =>
      make as Requiring<F, CapabilityId<Caps[number]>>;
