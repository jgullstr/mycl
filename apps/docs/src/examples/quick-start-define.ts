import { createFnChannel } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

const price = capable((n: number) => `USD ${n}`, 'price');

// With nothing bound, the default fires.
mycl(() => {
  // 'USD 9'
  console.log(price(9));
})();
