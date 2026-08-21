import { expect } from '@open-wc/testing';
import {
  __setAnchoredOverlayRuntimeLoaderForTesting,
  loadAnchoredOverlayRuntime,
  type AnchoredOverlayRuntime,
} from './anchored-overlay-runtime.js';

const runtime = {
  place: () => () => undefined,
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
