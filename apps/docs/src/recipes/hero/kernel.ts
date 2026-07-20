import { createFnChannel } from '@mycl/core';

// One channel for the whole recipe: everything minted and scoped here shares
// it. Mint it once, in one module, and import the bound surface everywhere.
export const { capable, mycl, channel } = createFnChannel('my-app-or-library');
