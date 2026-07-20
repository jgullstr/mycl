import { createFnChannel, registry } from '@mycl/core';

const { capable, scope } = createFnChannel('my-app-or-library');

const greet = capable((name: string) => `hello ${name}`, 'greet');

// scope(fn): empty scope, the default runs.
console.log(scope(greet)('world')); // 'hello world'

// scope(fn, reg): dispatch through reg's bindings.
const friendly = registry().layer(greet, (name: string) => `hi ${name}!`);
console.log(scope(greet, friendly)('world')); // 'hi world!'
