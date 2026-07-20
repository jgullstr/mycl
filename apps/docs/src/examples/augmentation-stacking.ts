import { createFnChannel, registry } from '@mycl/core';

const { capable, mycl } = createFnChannel('my-app-or-library');

const task = capable(() => {
  console.log('  core');
  return 'done';
}, 'task');

// Two wrappers that log as control enters and leaves them.
const inner = (next: () => string) => (): string => {
  console.log('inner: enter');
  const r = next();
  console.log('inner: leave');
  return r;
};
const outer = (next: () => string) => (): string => {
  console.log('outer: enter');
  const r = next();
  console.log('outer: leave');
  return r;
};

const reg = registry()
  // added first: innermost
  .augment(task, inner)
  // added second: outermost
  .augment(task, outer);

mycl(() => {
  // outer: enter
  // inner: enter
  //   core
  // inner: leave
  // outer: leave
  // 'done'
  console.log(task());
}, reg)();
