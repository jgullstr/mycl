import { describe, expectTypeOf, it } from 'vitest';
import type { IdPath, CapabilityId } from '../types';
import { createChannel } from '../../channel/createChannel';
import { connectorOf } from '../../tests/connectorOf';

const { capable } = createChannel('diag', connectorOf({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() }));

describe('IdPath', () => {
  it('passes any non-empty path through unchanged, slashed or flat', () => {
    expectTypeOf<IdPath<'app/thing'>>().toEqualTypeOf<'app/thing'>();
    expectTypeOf<IdPath<'app/nested/thing'>>().toEqualTypeOf<'app/nested/thing'>();
    expectTypeOf<IdPath<'flat'>>().toEqualTypeOf<'flat'>();
  });

  it('replaces an empty path with a self-describing message', () => {
    expectTypeOf<IdPath<''>>()
      .toEqualTypeOf<'mycl: identifier path must be non-empty'>();
  });

  it('keeps parity with the runtime guard on the accepting side', () => {
    // A template-typed path is not definitely empty, so it stays accepted.
    expectTypeOf<IdPath<`${string}/thing`>>().toEqualTypeOf<`${string}/thing`>();
  });

  it('capable infers the assembled identifier literal through the validation', () => {
    const slashed = capable((x: number) => x, 'app/thing');
    expectTypeOf<CapabilityId<typeof slashed>>().toEqualTypeOf<'diag:app/thing'>();
    const flat = capable((x: number) => x, 'flatpath');
    expectTypeOf<CapabilityId<typeof flat>>().toEqualTypeOf<'diag:flatpath'>();
  });

  it('rejects an empty path at the call site', () => {
    // @ts-expect-error identifier path must be non-empty
    void (() => capable((x: number) => x, ''));
  });

  it('explicit partial instantiation (defaulted Id) degrades to plain string', () => {
    type Fn = () => string;
    const cap = capable<Fn, string, [string]>(() => 'btn', 'app/explicit', {
      strategy: {
        step: (parent) => (b) => `${parent ?? ''} ${b}`,
        extract: (value) => () => value,
      },
    });
    // A defaulted Id cannot reject an empty path at the type level (the dev
    // runtime guard backstops it); the assembled literal keeps the channel prefix.
    expectTypeOf<CapabilityId<typeof cap>>().toEqualTypeOf<`diag:${string}`>();
  });

  it('fully explicit instantiation still validates and assembles the literal', () => {
    type Fn = () => string;
    const cap = capable<Fn, string, [string], 'app/full'>(() => 'btn', 'app/full', {
      strategy: {
        step: (parent) => (b) => `${parent ?? ''} ${b}`,
        extract: (value) => () => value,
      },
    });
    expectTypeOf<CapabilityId<typeof cap>>().toEqualTypeOf<'diag:app/full'>();
    // @ts-expect-error an empty path is rejected under a fully explicit Id
    void (() => capable<Fn, string, [string], ''>(() => 'btn', ''));
  });
});

describe('channel-name diagnostics', () => {
  it('accepts a clean name and preserves the literal', () => {
    const api = createChannel('diag-clean', connectorOf({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() }));
    expectTypeOf(api.channel.name).toEqualTypeOf<'diag-clean'>();
  });

  it('rejects names containing identity separators, naming the offender', () => {
    // @ts-expect-error channel name must not contain ':'
    void (() => createChannel('bad:name', connectorOf({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() })));
    // @ts-expect-error channel name must not contain '/'
    void (() => createChannel('bad/name', connectorOf({ get: () => undefined, run: <T>(_: unknown, fn: () => T): T => fn() })));
  });
});
