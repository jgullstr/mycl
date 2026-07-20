import { createFnChannel, registry } from '@mycl/core';

const { capable, snapshot, mycl } = createFnChannel('my-app-or-library');

const price = capable((n: number) => `USD ${n}`, 'price');
const euros = registry().layer(price, (n: number) => `EUR ${n}`);

const makeCart = mycl(() => ({
  // snapshot keeps the build-time scope alive for calls made later.
  total: snapshot((n: number) => `Total: ${price(n)}`),
}), euros);

const cart = makeCart();
// 'Total: EUR 9'
console.log(cart.total(9));
