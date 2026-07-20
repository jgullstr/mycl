import { createFnChannel, registry } from '@mycl/core';

const { capable, snapshot, mycl } = createFnChannel('my-app-or-library');

// buttonClass folds its layers into one space-joined class string.
const buttonClass = capable(() => 'btn', 'buttonClass', {
  strategy: {
    // acc is the string folded so far, undefined on the first layer.
    step: (acc: string | undefined) => (next: string) =>
      acc === undefined ? next : `${acc} ${next}`,
    // project the folded string back into the capability's callable.
    extract: (classes: string) => () => classes,
  },
});

const theme = registry().layer(buttonClass, 'bg-blue-600 text-white');
const compact = registry().layer(buttonClass, 'px-2 py-1');

// mycl folds theme then compact for buttonClass. The two registries never
// know about each other.
const ui = mycl(() => ({
  className: snapshot(() => buttonClass()),
}), theme, compact)();

console.log(ui.className()); // 'bg-blue-600 text-white px-2 py-1'
