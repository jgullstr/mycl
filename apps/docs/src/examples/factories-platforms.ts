import { createFnChannel, registry } from '@mycl/core';

const { capable, snapshot, mycl } = createFnChannel('my-app-or-library');

// One storage capability with no usable default: the platform must bind it.
const storage = capable((): Record<string, string> => {
  throw new Error('bind a storage backend');
}, 'storage');

// One builder, platform-agnostic: it never names a platform.
const makeStore = () => ({
  save: snapshot((key: string, value: string) => {
    storage()[key] = value;
  }),
  read: snapshot((key: string) => storage()[key]),
});

// Two registries pick the backend. The builder is identical for both.
const serverBacking: Record<string, string> = {};
const browserBacking: Record<string, string> = {};
const server = mycl(makeStore, registry().layer(storage, () => serverBacking))();
const browser = mycl(makeStore, registry().layer(storage, () => browserBacking))();

server.save('token', 'srv-123');
browser.save('token', 'br-999');

console.log(server.read('token')); // 'srv-123'
console.log(browser.read('token')); // 'br-999'
