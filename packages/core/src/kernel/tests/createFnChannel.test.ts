import { describe, expect, expectTypeOf, it } from 'vitest';
import { createFnChannel, registry } from '@mycl/core';
import type { FnKernel } from '@mycl/core';
import type { CapabilityId } from '@mycl/core';

/**
 * createFnChannel: the preconfigured maker, one application of the
 * mechanism (createChannel with fnConnector). One import, one call.
 */

describe('createFnChannel(name)', () => {
  it('is the one-call front door: full kernel, literal types, no annotations', () => {
    const app = createFnChannel('formox');
    expectTypeOf(app).toEqualTypeOf<FnKernel<'formox'>>();
    expectTypeOf(app.channel.name).toEqualTypeOf<'formox'>();
    const cap = app.capable((x: number) => x, 'project/cap');
    expectTypeOf<CapabilityId<typeof cap>>().toEqualTypeOf<'formox:project/cap'>();
    const reg = registry().layer(cap, (x: number) => x * 10);
    expect(app.scope((x: number) => cap(x), reg)(4)).toBe(40);
  });

  it('mints a fresh channel per call: two makers stay isolated', () => {
    const a = createFnChannel('mk-a');
    const b = createFnChannel('mk-b');
    const capA = a.capable((x: number) => x, 't/mk');
    const regA = registry().layer(capA, (x: number) => x + 41);
    const inner = b.scope((x: number) => capA(x), registry());
    expect(a.scope((x: number) => inner(x), regA)(1)).toBe(42);
  });
});
