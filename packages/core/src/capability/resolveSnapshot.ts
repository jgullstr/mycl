/**
 * @file
 * The snapshot constructor: resolveSnapshot is the channel-keyed mirror of
 * resolveCapable, capturing a channel's scope at snapshot time for replay later,
 * including across an async boundary a capability's own dispatch could not
 * otherwise survive.
 */

import type { AnyFn } from '../util/types';
import type { Snapshotted } from './types';
import type { Channel } from '../channel/types';
import { getChannelSlot } from '../channel/slot';

/**
 * Channel-keyed snapshot factory, the mirror of resolveCapable. The returned snapshot
 * captures the channel's current registry from ctx.get() at snapshot time,
 * including "no scope" (undefined), and replays it with one ctx.run per
 * call. A no-scope snapshot shadows any ambient scope at call time, so a
 * missed async boundary fails loud instead of adopting a stranger's scope.
 * Multi-channel capture is composition: snapA(snapB(fn)).
 */
export const resolveSnapshot = (channel: Channel) => {
  const slot = getChannelSlot(channel);
  return <T extends AnyFn>(fn: T): Snapshotted<T> => {
    const reg = slot.current.get();
    return function snapshotted(this: unknown, ...args: unknown[]) {
      return slot.current.run(reg, () => (fn as AnyFn).apply(this, args));
    } as Snapshotted<T>;
  };
};
