import { createFnChannel, registry } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

const greeting = capable((): string => 'hello', 'greeting');

// Two layers for one capability, in one registry.
const reg = registry()
  .layer(greeting, () => 'hi')
  .layer(greeting, () => 'good day');

// No strategy configured, so the last binding wins.
mycl(() => {
  // 'good day'
  console.log(greeting());
}, reg)();
