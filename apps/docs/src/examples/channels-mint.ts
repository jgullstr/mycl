import { createFnChannel } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

const greet = capable((name: string) => `hello ${name}`, 'greet');

// App logic runs inside a factory's resolved scope.
mycl(() => {
  // 'hello world'
  console.log(greet('world'));
})();
