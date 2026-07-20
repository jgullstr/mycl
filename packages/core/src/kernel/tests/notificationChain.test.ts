import { describe, expect, it } from 'vitest';
import { registry } from '@mycl/core';
import { before } from '@mycl/core/helpers';
import { capable } from './defaultContext';
import { merge } from '@mycl/core/factory';
import { scope } from './scope';

// ── Scenario: the notification chain ────────────────────────────────────────
//
// One capability, `notify`. Base = dev console. The product team layers email.
// A tenant layers SMS. Compliance augments an audit trail but layers nothing.
//
// Pins the four behaviours of the internal last-wins (default) strategy:
//   1. no layer        → base fallback
//   2. one registry    → last .layer() call wins within it
//   3. composition     → last registry wins across it (order IS the semantics)
//   4. augments        → accumulate across all registries while layers replace
//
// Plus the docility property: two scopes with different winners coexist.

const notify = capable(
  (user: string, msg: string) => `console → ${user}: ${msg}`,
  't/notify',
);

const email = (user: string, msg: string) => `email → ${user}: ${msg}`;
const sms = (user: string, msg: string) => `sms → ${user}: ${msg}`;

describe('default strategy: internal last-wins', () => {
  it('1. falls back to base when nothing is layered', () => {
    const send = scope(() => notify('ada', 'hi'));
    expect(send()).toBe('console → ada: hi');
  });

  it('2. the last .layer() call wins within a single registry', () => {
    // The product team configured email, then reconsidered and chose SMS.
    const reconsidered = registry()
      .layer(notify, email)
      .layer(notify, sms);

    const send = scope(() => notify('ada', 'hi'), reconsidered);
    expect(send()).toBe('sms → ada: hi');
  });

  it('3. the last registry wins across a composition — order is the semantics', () => {
    const product = registry().layer(notify, email);
    const tenant = registry().layer(notify, sms);

    const tenantOverridesProduct = scope(
      () => notify('ada', 'hi'),
      merge(product, tenant),
    );
    const productOverridesTenant = scope(
      () => notify('ada', 'hi'),
      merge(tenant, product),
    );

    expect(tenantOverridesProduct()).toBe('sms → ada: hi');
    expect(productOverridesTenant()).toBe('email → ada: hi');
  });

  it('4. augments accumulate while layers replace', () => {
    const audit: string[] = [];

    // Compliance registered FIRST and layers nothing — it only observes.
    const compliance = registry().augment(
      notify,
      before((user, msg) => audit.push(`audit: ${user} ← ${msg}`)),
    );
    const product = registry().layer(notify, email);
    const tenant = registry().layer(notify, sms);

    const send = scope(
      () => notify('ada', 'hi'),
      merge(compliance, product, tenant),
    );

    // The tenant's SMS won the layer contest...
    expect(send()).toBe('sms → ada: hi');
    // ...but compliance's augment wrapped the winner it never knew about.
    expect(audit).toEqual(['audit: ada ← hi']);
  });

  it('5. different winners coexist in different scopes', () => {
    const product = registry().layer(notify, email);
    const tenant = registry().layer(notify, sms);

    const productSend = scope(() => notify('ada', 'hi'), product);
    const tenantSend = scope(() => notify('ada', 'hi'), tenant);
    const baseSend = scope(() => notify('ada', 'hi'));

    // Same process, same capability, three simultaneous truths.
    expect(productSend()).toBe('email → ada: hi');
    expect(tenantSend()).toBe('sms → ada: hi');
    expect(baseSend()).toBe('console → ada: hi');
  });
});
