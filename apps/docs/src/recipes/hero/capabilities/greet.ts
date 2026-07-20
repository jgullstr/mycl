import { capable } from '../kernel';

// Your plain function.
const sayHi = (name: string) => `hi, ${name}`;

// Wrap it with capable() and it becomes an extension point other code can
// replace, wrap or observe from outside its call site.
export const greet = capable(sayHi, 'greet');

// An alternative greeting the registry layers in later.
export const sayHello = (name: string) => `hello, ${name}`;
