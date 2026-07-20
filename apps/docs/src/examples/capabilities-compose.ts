import { createFnChannel } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

const currency = capable((n: number) => `USD ${n}`, 'currency');

// priceTag calls currency: a capability is a plain function.
const priceTag = capable((n: number) => `Price: ${currency(n)}`, 'priceTag');

// Both dispatch through the one active scope.
mycl(() => {
  // 'Price: USD 9'
  console.log(priceTag(9));
})();
