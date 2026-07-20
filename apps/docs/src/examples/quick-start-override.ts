import { createFnChannel, registry } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

const price = capable((n: number) => `USD ${n}`, 'price');

// One registry, one binding.
const euros = registry().layer(price, (n: number) => `EUR ${n}`);

// Same call, different scope, different result.
mycl(() => {
  // 'USD 9' (default)
  console.log(price(9));
})();

mycl(() => {
  // 'EUR 9' (scoped override)
  console.log(price(9));
}, euros)();
