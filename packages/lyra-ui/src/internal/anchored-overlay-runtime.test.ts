import { expect, waitUntil } from '@open-wc/testing';
import {
  __setAnchoredOverlayRuntimeLoaderForTesting,
  deferredPlace,
  deferredPlaceReady,
  deferredPlaceSession,
  deferredTrackRect,
  loadAnchoredOverlayRuntime,
  PopupTransitionWaiters,
  awaitPopupAnimations,
  settlePopupTransition,
  syncTopLayerRelease,
  waitForDeferredPlacement,
  type AnchoredOverlayRuntime,
  type DeferredOperationHandle,
  type DeferredPlacementSession,
} from './anchored-overlay-runtime.js';

const runtime = {
  place: () => () => undefined,
  trackRect: () => () => undefined,
} as AnchoredOverlayRuntime;

afterEach(() => __setAnchoredOverlayRuntimeLoaderForTesting(undefined));

it('ignores a successful placement after a newer operation supersedes it', async () => {
  const old = Object.assign(() => undefined, { ready: Promise.resolve(true) }) as DeferredOperationHandle;
  const next = Object.assign(() => undefined, { ready: Promise.resolve(false) }) as DeferredOperationHandle;
  let current: DeferredOperationHandle | undefined = old;
  const result = waitForDeferredPlacement(() => current);
  current = next;
  expect(await result).to.equal(false);
});

it('keeps a retained placement paused when its runtime resolves before new geometry', async () => {
  let resolve!: (value: AnchoredOverlayRuntime) => void;
  const pending = new Promise<AnchoredOverlayRuntime>(done => { resolve = done; });
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pending);
  let starts = 0, stops = 0, updates = 0, invalidations = 0;
  const popup = document.createElement('div'); popup.style.visibility = 'visible';
  const operation = deferredPlaceSession(document.createElement('button'), popup);
  try {
    operation.invalidate(); operation.invalidate();
    resolve({ ...runtime, placeSession: (_anchor, _popup, options = {}) => {
      starts++; options.onPlaced?.({ placement: 'top' });
      return Object.assign(() => { stops++; }, {
        isActive: () => true,
        invalidate() { invalidations++; },
        update() { updates++; options.onPlaced?.({ placement: 'top' }); },
      });
    } });
    await pending; await new Promise<void>(done => setTimeout(done, 0));
    expect(starts).to.equal(0); expect(popup.style.visibility).to.equal('hidden');
    operation.update(); expect(await operation.ready).to.equal(true);
    expect(starts).to.equal(1); expect(popup.style.visibility).to.equal('visible');
    operation.invalidate(); operation.update();
    expect(starts).to.equal(1); expect(invalidations).to.equal(1); expect(updates).to.equal(1);
    operation(); operation(); expect(stops).to.equal(1);
  } finally { operation(); }
});

it('disposes a retained operation before import without starting its subscriptions', async () => {
  let resolve!: (value: AnchoredOverlayRuntime) => void;
  const pending = new Promise<AnchoredOverlayRuntime>(done => { resolve = done; });
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pending);
  let starts = 0;
  const operation = deferredPlaceSession(document.createElement('button'), document.createElement('div'));
  operation(); expect(await operation.ready).to.equal(false);
  resolve({ ...runtime, placeSession: () => {
    starts++; return Object.assign(() => undefined, { isActive: () => true, invalidate() {}, update() {} });
  } });
  await pending; await new Promise<void>(done => setTimeout(done, 0));
  operation.update(); expect(starts).to.equal(0);
});

it('reports a retained runtime that fails after first placement as retired', async () => {
  let running = true;
  __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({ ...runtime, placeSession: (_anchor, _popup, options = {}) => {
    options.onPlaced?.({ placement: 'top' });
    return Object.assign(() => { running = false; }, {
      isActive: () => running, invalidate() {}, update() {},
    });
  } }));
  const operation = deferredPlaceSession(document.createElement('button'), document.createElement('div'));
  try {
    expect(await operation.ready).to.equal(true); expect(operation.isActive()).to.equal(true);
    running = false;
    expect(operation.isActive(), 'First-placement success does not conceal later runtime disposal').to.equal(false);
  } finally { operation(); }
});

it('reports import failure as retired even when invalidation preceded its rejection', async () => {
  let reject!: (reason: Error) => void;
  const pending = new Promise<AnchoredOverlayRuntime>((_resolve, fail) => { reject = fail; });
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pending);
  const operation = deferredPlaceSession(document.createElement('button'), document.createElement('div'));
  try {
    operation.invalidate(); expect(operation.isActive()).to.equal(true);
    reject(new Error('Runtime unavailable'));
    expect(await operation.ready).to.equal(false);
    expect(operation.isActive()).to.equal(false);
  } finally { operation(); }
});

it('restarts an injected legacy runtime and ignores callbacks from its invalidated run', async () => {
  const callbacks: (() => void)[] = [];
  let stops = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({ ...runtime, place: (_anchor, _popup, options = {}) => {
    callbacks.push(() => options.onPlaced?.({ placement: 'top' })); return () => { stops++; };
  } }));
  const popup = document.createElement('div'); popup.style.visibility = 'visible';
  const operation = deferredPlaceSession(document.createElement('button'), popup);
  try {
    await waitUntil(() => callbacks.length === 1);
    operation.invalidate(); callbacks[0]!();
    expect(stops).to.equal(1); expect(popup.style.visibility).to.equal('hidden');
    operation.update(); expect(callbacks.length).to.equal(2);
    callbacks[0]!(); expect(popup.style.visibility).to.equal('hidden');
    callbacks[1]!(); expect(await operation.ready).to.equal(true); expect(popup.style.visibility).to.equal('visible');
    operation(); expect(stops).to.equal(2);
  } finally { operation(); }
});

it('cleans up a synchronously publishing session when its placed callback disposes the operation', async () => {
  let stops = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({ ...runtime, placeSession: (_anchor, _popup, options = {}) => {
    options.onPlaced?.({ placement: 'top' });
    return Object.assign(() => { stops++; }, { isActive: () => true, invalidate() {}, update() {} });
  } }));
  const operation: DeferredPlacementSession = deferredPlaceSession(document.createElement('button'), document.createElement('div'), {
    onPlaced: () => { operation(); },
  });
  await operation.ready; await waitUntil(() => stops === 1);
  operation(); expect(stops).to.equal(1);
});

it('resolves only the superseded popup transition waiters', async () => {
  const waiters = new PopupTransitionWaiters<'show' | 'hide'>();
  const settled: string[] = [];
  void waiters.wait('show').then(() => settled.push('show'));
  void waiters.wait('hide').then(() => settled.push('hide'));
  waiters.resolve('show');
  await Promise.resolve();
  expect(settled).to.deep.equal(['show']);
  waiters.resolve('hide');
  await Promise.resolve();
  expect(settled).to.deep.equal(['show', 'hide']);
});

it('does not settle a superseded popup paint', async () => {
  const host = document.createElement('div');
  expect(await awaitPopupAnimations(host, () => null, () => false)).to.equal(false);
  expect(await awaitPopupAnimations(host, () => null, () => true)).to.equal(true);
});

it('does not settle an old-document popup paint after adoption', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const host = document.createElement('div');
  document.body.append(host);
  try {
    const pending = awaitPopupAnimations(host, () => null, () => true);
    frame.contentDocument!.adoptNode(host);
    expect(await pending).to.equal(false);
  } finally {
    host.remove();
    frame.remove();
  }
});

it('keeps popup placement and concealment in transition order', async () => {
  const host = Object.assign(document.createElement('div'), { updateComplete: Promise.resolve(true) });
  const order: string[] = [];
  await settlePopupTransition({
    host,
    popup: () => null,
    isCurrent: () => true,
    waitForPosition: async () => { order.push('position'); return true; },
    onSettled: () => order.push('show'),
  });
  await settlePopupTransition({
    host,
    popup: () => null,
    isCurrent: () => true,
    conceal: () => order.push('conceal'),
    onSettled: () => order.push('hide'),
  });
  expect(order).to.deep.equal(['position', 'show', 'conceal', 'hide']);
});

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

it('loads the escape-aware placement and the explicit top-layer release by default', async () => {
  __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  const loaded = await loadAnchoredOverlayRuntime();
  const positioner = await import('./positioner.js');
  expect(loaded.place).to.equal(positioner.placeAnchoredSurface);
  expect(loaded.place).to.not.equal(positioner.place);
  expect(loaded.trackRect).to.equal(positioner.trackRect);
  expect(loaded.releaseTopLayer).to.equal(positioner.releaseTopLayer);
});

it('honours an injected runtime without releaseTopLayer, where the optional release is a no-op', async () => {
  __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.resolve(runtime));
  const loaded = await loadAnchoredOverlayRuntime();
  expect(loaded.releaseTopLayer).to.equal(undefined);
  const element = document.createElement('div');
  expect(() => loaded.releaseTopLayer?.(element)).to.not.throw();
});


describe('top-layer release ordering', () => {
  it('releases before synchronous placement with an already loaded runtime', async () => {
    const order: string[] = [];
    const loaded: AnchoredOverlayRuntime = {
      ...runtime,
      releaseTopLayer: () => { order.push('release'); },
      place: () => { order.push('place'); return () => undefined; },
    };
    __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.resolve(loaded));
    const ready = await loadAnchoredOverlayRuntime();
    const anchor = document.createElement('button');
    const popup = document.createElement('div');
    syncTopLayerRelease(popup, true, false, ready);
    ready.place(anchor, popup);
    await Promise.resolve();
    expect(order).to.deep.equal(['release', 'place']);
  });
});
