import { mycl } from './kernel';
import { greet } from './capabilities/greet';
import { extensions } from './extensions';

// Call the capability inside a mycl() scope. With nothing bound, it runs its base.
const baseApp = mycl(() => greet('world'));
console.log('baseApp:', baseApp());

// Run the SAME app with the extensions in scope: same call site, new behavior.
const extendedApp = mycl(baseApp, extensions);
console.log('extendedApp:', extendedApp());
