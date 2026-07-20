import { createFnChannel } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

// capable(fn, idPath) turns a function into a capability.
const greet = capable((name: string) => `hello ${name}`, 'greet');

// A capability dispatches through the active scope. With nothing bound,
// the default implementation runs.
mycl(() => {
  // 'hello world'
  console.log(greet('world'));
})();
