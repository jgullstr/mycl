import { createFnChannel, registry } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

// Business code calls a capability; its base is the real implementation.
const taxRate = capable(
  (region: string): number => (region === 'US' ? 0.08 : 0.25),
  'taxRate',
);

const priceWithTax = (amount: number, region: string) =>
  amount * (1 + taxRate(region));

// A registry re-binds taxRate; priceWithTax is never edited. The signature
// still binds: .layer(taxRate, () => 'free') would be a compile error.
const zeroTax = registry().layer(taxRate, () => 0);

// mycl() returns a factory: the same app logic, bound to a scope.
const checkout = mycl(() => priceWithTax(100, 'SE'));
const zeroTaxCheckout = mycl(() => priceWithTax(100, 'SE'), zeroTax);

console.log(checkout()); // 125 (default 25%)
console.log(zeroTaxCheckout()); // 100 (scoped override)
