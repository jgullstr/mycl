import { createFnChannel, registry } from '@mycl/core';
import { after } from '@mycl/core/helpers';

const { capable, snapshot, mycl } = createFnChannel('my-app-or-library');

const greet = capable((name: string) => `hello ${name}`, 'greet');

const makeApp = mycl(() => ({
  greet: snapshot((name: string) => greet(name)),
}), registry().layer(greet, (name: string) => `hi ${name}`));

// Extend: fold a logging augment on top without touching makeApp.
const logging = registry().augment(greet, after((r) => console.log('greeted:', r)));
const makeLoggingApp = mycl(makeApp, logging);

console.log(makeApp().greet('ada')); // 'hi ada' (base, no log)
console.log(makeLoggingApp().greet('grace')); // logs 'greeted: hi grace', then 'hi grace'
