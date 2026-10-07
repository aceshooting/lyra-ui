import { expect } from '@open-wc/testing';
import { OwnedFrame, OwnedInterval, OwnedTimeout } from './owned-timer.js';

describe('realm-owned schedules', () => {
  it('clears the owner window and rejects callbacks from cancelled generations', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const originalSet = window.setTimeout;
    const originalClear = window.clearTimeout;
    const callbacks: Array<() => void> = [];
    const cleared: number[] = [];
    window.setTimeout = ((callback: TimerHandler) => {
      callbacks.push(callback as () => void);
      return callbacks.length;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) cleared.push(handle);
    }) as typeof window.clearTimeout;
    try {
      const timer = new OwnedTimeout(host);
      let calls = 0;
      timer.schedule(10, () => { calls += 1; });
      timer.schedule(10, () => { calls += 10; });
      expect(cleared).to.deep.equal([1]);
      callbacks[0]?.();
      expect(calls).to.equal(0);
      callbacks[1]?.();
      expect(calls).to.equal(10);
      expect(timer.pending).to.be.false;
      timer.schedule(10, () => { calls += 100; });
      host.remove();
      callbacks[2]?.();
      expect(calls).to.equal(10);
      timer.cancel();
      expect(cleared).to.deep.equal([1, 3]);
    } finally {
      host.remove();
      window.setTimeout = originalSet;
      window.clearTimeout = originalClear;
    }
  });

  it('keeps recurring intervals and frames separately cancellable', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const originalInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    const originalFrame = window.requestAnimationFrame;
    const originalCancelFrame = window.cancelAnimationFrame;
    let intervalCallback: (() => void) | undefined;
    let frameCallback: FrameRequestCallback | undefined;
    const cleared: string[] = [];
    window.setInterval = ((callback: TimerHandler) => {
      intervalCallback = callback as () => void;
      return 41;
    }) as typeof window.setInterval;
    window.clearInterval = ((handle?: number) => { cleared.push(`interval:${handle}`); }) as typeof window.clearInterval;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 42;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => { cleared.push(`frame:${handle}`); }) as typeof window.cancelAnimationFrame;
    try {
      const interval = new OwnedInterval(host);
      const frame = new OwnedFrame(host);
      let ticks = 0;
      interval.schedule(100, () => { ticks += 1; });
      frame.schedule(() => { ticks += 10; });
      intervalCallback?.();
      intervalCallback?.();
      frameCallback?.(100);
      expect(ticks).to.equal(12);
      expect(frame.pending).to.be.false;
      interval.cancel();
      frame.schedule(() => { ticks += 100; });
      frame.cancel();
      intervalCallback?.();
      frameCallback?.(200);
      expect(ticks).to.equal(12);
      expect(cleared).to.deep.equal(['interval:41', 'frame:42']);
    } finally {
      host.remove();
      window.setInterval = originalInterval;
      window.clearInterval = originalClearInterval;
      window.requestAnimationFrame = originalFrame;
      window.cancelAnimationFrame = originalCancelFrame;
    }
  });
});
