import { expect, waitUntil } from '@open-wc/testing';
import {
  __setAnchoredOverlayRuntimeLoaderForTesting,
  deferredPlace,
  deferredPlaceReady,
  deferredTrackRect,
  loadAnchoredOverlayRuntime,
  type AnchoredOverlayRuntime,
} from './anchored-overlay-runtime.js';

const runtime = {
  place: () => () => undefined,
  trackRect: () => () => undefined,
} as AnchoredOverlayRuntime;

afterEach(() => __setAnchoredOverlayRuntimeLoaderForTesting(undefined));

it('loads the anchored runtime once and shares the cached first-open promise', async () => {
  let resolve!: (value: AnchoredOverlayRuntime) => void;
  const pending = new Promise<AnchoredOverlayRuntime>((resolvePromise) => {
    resolve = resolvePromise;
  });
  let calls = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => {
    calls++;
    return pending;
  });

  const first = loadAnchoredOverlayRuntime();
  const second = loadAnchoredOverlayRuntime();
  expect(first).to.equal(second);
  expect(calls).to.equal(1);
  resolve(runtime);
  expect(await first).to.equal(runtime);
  expect(await loadAnchoredOverlayRuntime()).to.equal(runtime);
  expect(calls).to.equal(1);
});

it('drops a rejected cache entry so a later open can retry the runtime load', async () => {
  let calls = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => {
    calls++;
    return calls === 1 ? Promise.reject(new Error('chunk unavailable')) : Promise.resolve(runtime);
  });

  let rejected = false;
  try {
    await loadAnchoredOverlayRuntime();
  } catch {
    rejected = true;
  }
  expect(rejected).to.equal(true);
  expect(await loadAnchoredOverlayRuntime()).to.equal(runtime);
  expect(calls).to.equal(2);
});

it('starts deferred placement once the shared runtime resolves and forwards cleanup', async () => {
  let resolve!: (value: AnchoredOverlayRuntime) => void;
  const pending = new Promise<AnchoredOverlayRuntime>((resolvePromise) => {
    resolve = resolvePromise;
  });
  let started = 0;
  let stopped = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pending);
  const anchor = document.createElement('button');
  const popup = document.createElement('div');
  popup.style.visibility = 'visible';

  const cleanup = deferredPlaceReady(anchor, popup);
  expect(popup.style.getPropertyValue('visibility')).to.equal('hidden');
  expect(started).to.equal(0);
  resolve({
    place: (_anchor, _popup, options = {}) => {
      started++;
      options.onPlaced?.({ placement: options.placement ?? 'bottom-start' });
      return () => stopped++;
    },
    trackRect: runtime.trackRect,
  } as AnchoredOverlayRuntime);
  await pending;
  await waitUntil(() => started === 1, 'deferred readiness placement did not start');

  expect(started).to.equal(1);
  expect(await cleanup.ready).to.equal(true);
  expect(popup.style.getPropertyValue('visibility')).to.equal('visible');
  cleanup();
  cleanup();
  expect(stopped).to.equal(1);
});

it('keeps the lean handle concealed until its first real placement', async () => {
  let onPlaced: (() => void) | undefined;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.resolve({
    place: (_anchor, _popup, options = {}) => {
      onPlaced = () => options.onPlaced?.({ placement: options.placement ?? 'bottom-start' });
      return () => undefined;
    },
    trackRect: runtime.trackRect,
  } as AnchoredOverlayRuntime));
  const anchor = document.createElement('button');
  const popup = document.createElement('div');
  popup.style.visibility = 'visible';

  const cleanup = deferredPlace(anchor, popup);
  expect(popup.style.visibility).to.equal('hidden');
  await waitUntil(() => onPlaced !== undefined, 'deferred lean placement did not start');
  expect(popup.style.visibility).to.equal('hidden');
  onPlaced?.();
  expect(popup.style.visibility).to.equal('visible');
  cleanup();
});

it('does not let an older placement generation reveal a replacement popup', async () => {
  const placements: (() => void)[] = [];
  let stopped = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.resolve({
    place: (_anchor, _popup, options = {}) => {
      placements.push(() => options.onPlaced?.({ placement: options.placement ?? 'bottom-start' }));
      return () => stopped++;
    },
    trackRect: runtime.trackRect,
  } as AnchoredOverlayRuntime));
  const anchor = document.createElement('button');
  const popup = document.createElement('div');
  popup.style.visibility = 'visible';

  const first = deferredPlace(anchor, popup);
  await waitUntil(() => placements.length === 1, 'first placement did not start');
  const second = deferredPlace(anchor, popup);
  await waitUntil(() => placements.length === 2, 'replacement placements did not start');
  expect(stopped).to.equal(1);
  placements[0]?.();
  expect(popup.style.visibility).to.equal('hidden');
  placements[1]?.();
  expect(popup.style.visibility).to.equal('visible');

  first();
  second();
});

it('cancels deferred positioning and rect tracking before an unresolved chunk can start', async () => {
  let resolve!: (value: AnchoredOverlayRuntime) => void;
  const pending = new Promise<AnchoredOverlayRuntime>((resolvePromise) => {
    resolve = resolvePromise;
  });
  let placeCalls = 0;
  let trackCalls = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pending);
  const target = document.createElement('div');

  deferredPlace(target, target)();
  deferredTrackRect(target, () => undefined)();
  resolve({
    place: () => {
      placeCalls++;
      return () => undefined;
    },
    trackRect: () => {
      trackCalls++;
      return () => undefined;
    },
  } as AnchoredOverlayRuntime);
  await pending;
  await Promise.resolve();

  expect(placeCalls).to.equal(0);
  expect(trackCalls).to.equal(0);
});

it('fails closed and exposes unsuccessful readiness when the runtime cannot load', async () => {
  __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.reject(new Error('chunk unavailable')));
  const anchor = document.createElement('button');
  const popup = document.createElement('div');
  popup.style.visibility = 'visible';

  const cleanup = deferredPlaceReady(anchor, popup);
  expect(popup.style.getPropertyValue('visibility')).to.equal('hidden');
  expect(await cleanup.ready).to.equal(false);
  expect(popup.style.getPropertyValue('visibility')).to.equal('hidden');

  cleanup();
  expect(popup.style.getPropertyValue('visibility')).to.equal('visible');
});

it('fails closed when the loaded positioning runtime rejects setup', async () => {
  __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.resolve({
    place: () => {
      throw new RangeError('invalid placement geometry');
    },
    trackRect: runtime.trackRect,
  } as AnchoredOverlayRuntime));
  const anchor = document.createElement('button');
  const popup = document.createElement('div');
  popup.style.visibility = 'visible';

  const cleanup = deferredPlaceReady(anchor, popup);
  expect(await cleanup.ready).to.equal(false);
  expect(popup.style.getPropertyValue('visibility')).to.equal('hidden');
  cleanup();
});
