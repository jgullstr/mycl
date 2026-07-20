import { createFnChannel } from '@mycl/core';

const { capable } = createFnChannel('my-app-or-library');

const greet = capable((name: string) => `hello ${name}`, 'greet');

// No scope on the stack: the call throws, naming the capability.
try {
  greet('world');
} catch (err) {
  console.log(String(err));
}
// Error: mycl: capability "my-app-or-library:greet" called outside any registry scope. …
