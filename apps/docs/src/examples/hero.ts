import { createFnChannel, registry } from '@mycl/core';
import { before, pipe } from '@mycl/core/helpers';

const { capable, mycl } = createFnChannel('my-app-or-library');

const sayHi = (name: string) => `hi, ${name}`; // Your function.
const greet = capable(sayHi, 'greet'); // Make it an extension point.

// Call it inside mycl() scope.
const baseApp = mycl(() => {
  const result = greet('world'); // Dynamic call site
  return result;
});
console.log('baseApp:', baseApp());

// Prepare some additional behaviors.
const sayHello = (name: string) => `hello, ${name}`;
const scream = (result: string) => result.toUpperCase();

// Create a registry for your extensions.
const extensions = registry()
  // Replace the base
  .layer(greet, sayHello)
  // Side-effect
  .augment(greet, before(() => console.log('preparing to scream')))
  // Transform the result
  .augment(greet, pipe(scream));

// Run the same app with the extensions in scope.
const extendedApp = mycl(baseApp, extensions);
console.log('extendedApp:', extendedApp());
