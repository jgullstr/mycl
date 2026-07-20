import { registry } from '@mycl/core';
import { before, pipe } from '@mycl/core/helpers';
import { greet, sayHello } from './capabilities/greet';
import { scream } from './capabilities/scream';

// A registry binds behaviors to capabilities. In scope, these reshape greet:
export const extensions = registry()
  // replace the base
  .layer(greet, sayHello)
  // run a side-effect first
  .augment(greet, before(() => console.log('preparing to scream')))
  // transform the result
  .augment(greet, pipe(scream));
