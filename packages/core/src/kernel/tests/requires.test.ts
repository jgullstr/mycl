import { describe, it, expectTypeOf, expect } from 'vitest';
import { registry } from '@mycl/core';
import type { Registry } from '@mycl/core';
import { capable } from './defaultContext';
import { mycl } from './mycl';
import { requires } from '../requires'; ;
import type { RequiredIds } from '../types'; ;

const db = capable((): string => {
  throw new Error('no db bound');
}, 'app/db');
const log = capable((_m: string): void => {}, 'app/log');

describe('requires', () => {
  it('brands make with the union of the capabilities\' identities', () => {
    const make = requires(db, log)(() => db());
    expectTypeOf<RequiredIds<typeof make>>().toEqualTypeOf<'mycl.fn:app/db' | 'mycl.fn:app/log'>();
  });

  it('returns a function that behaves identically to make (runtime)', () => {
    const make = requires(db)((n: number) => n + 1);
    expect(make(1)).toBe(2);
  });
});

describe('mycl provider-completeness check', () => {
  it('compiles when the registry provides every required capability', () => {
    const make = requires(db, log)(() => db());
    const reg = registry().layer(db, () => 'real').layer(log, (_m: string) => {});
    mycl(make, reg);
  });

  it('compiles when requirements are split across multiple registries', () => {
    const make = requires(db, log)(() => db());
    const dbReg = registry().layer(db, () => 'real');
    const logReg = registry().layer(log, (_m: string) => {});
    mycl(make, dbReg, logReg);
  });

  it('errors when a required capability is missing', () => {
    const make = requires(db, log)(() => db());
    const reg = registry().layer(db, () => 'real'); // missing log
    // @ts-expect-error registry is missing required capability mycl.fn:app/log
    mycl(make, reg);
  });

  it('bare mycl with no requires compiles unchanged (backward compat)', () => {
    const make = () => db();
    mycl(make, registry());
  });

  it('degrades to unchecked when the registry type is widened (fail-open, by design)', () => {
    const make = requires(db)(() => db());
    // Widening erases the manifest, so ProvidedIds is `string` and the required
    // set is vacuously covered. Runtime still fails loud via the throwing base.
    const wide: Registry = registry();
    const factory = mycl(make, wide);
    expect(typeof factory).toBe('function');
  });
});
