import assert from 'node:assert/strict';
import test from 'node:test';
import { panoramaPoint } from '../dist/panorama/camera.js';
import { createPanoramaEngine } from '../dist/panorama/engine.js';
import { watchPanoramaVideo } from '../dist/panorama/video.js';
import { installFakeBrowser } from './fake-browser.mjs';

test('non-finite hotspot angles collapse to the origin instead of poisoning the scene with NaN', () => {
  assert.deepEqual(panoramaPoint(Number.NaN, 0), { x: 0, y: 0, z: 0 });
  assert.deepEqual(panoramaPoint(0, Number.NaN), { x: 0, y: 0, z: 0 });
  assert.deepEqual(panoramaPoint(0, 0), { x: 0, y: 0, z: -10 });
});

const mediaServices = () => ({
  inspectMedia: (source) => ({ kind: source.kind, element: source.kind === 'image' ? source.image : source.video, width: 400, height: 200 }),
  probe() {},
});

test('hotspot sizes must be finite diameters from zero to 256 pixels', () => {
  const engine = createPanoramaEngine(mediaServices());
  const source = { kind: 'image', image: { width: 4, height: 2 } };
  const angles = new Float32Array([0, 0]);
  for (const size of [-1, 257, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => engine.setData({ source, hotspotAngles: angles, hotspotSizes: new Float32Array([size]) }, 1), /hotspot size/u, String(size));
  }
  assert.throws(() => engine.setData({ source, hotspotAngles: angles, hotspotSizes: [4] }, 1), /hotspot sizes/u);
  assert.throws(() => engine.setData({ source, hotspotAngles: angles, hotspotSizes: new Float32Array(2) }, 1), /hotspot sizes/u);
  engine.setData({ source, hotspotAngles: angles, hotspotSizes: new Float32Array([256]) }, 1);
  assert.deepEqual(engine.positionOf(0), { x: 0, y: 0, z: -10 });
  engine.dispose();
});

/** A video element whose frame callbacks the test can inspect and drive. */
function scriptedVideo() {
  const native = new Map();
  const timers = new Map();
  let next = 0;
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    defaultView: {
      requestAnimationFrame() { next += 1; return next; }, cancelAnimationFrame() {},
      setTimeout(callback) { next += 1; timers.set(next, callback); return next; }, clearTimeout(id) { timers.delete(id); },
    },
  });
  const video = Object.assign(new EventTarget(), {
    paused: false, ended: false, readyState: 2, currentTime: 0, videoWidth: 400, videoHeight: 200, ownerDocument: document,
    requestVideoFrameCallback(callback) { next += 1; native.set(next, callback); return next; },
    cancelVideoFrameCallback(id) { native.delete(id); },
  });
  return { video, native, timers };
}

test('the panorama pauses video frame observation while its container is scrolled out of view', async (t) => {
  const browser = installFakeBrowser();
  const observers = [];
  class FakeObserver {
    disconnected = 0;
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected += 1; }
  }
  browser.container.ownerDocument = { defaultView: { IntersectionObserver: FakeObserver } };
  const { video, native } = scriptedVideo();
  const engine = createPanoramaEngine(mediaServices());
  t.after(() => {
    try { engine.dispose(); } finally { browser.restore(); }
  });
  engine.setData({ source: { kind: 'video', video } }, 1);
  await engine.mount(browser.container, { hover() {}, pick() {}, camera() {}, lost() {} });
  const [observer] = observers;
  assert.equal(observers.length, 1);
  assert.equal(observer.target, browser.container, 'the container is what scrolls out of view');
  assert.equal(native.size, 1, 'a visible, playing video is being observed');
  observer.callback([{ isIntersecting: false }]);
  assert.equal(native.size, 0, 'scrolling away cancels the pending frame request');
  observer.callback([{ isIntersecting: false }, { isIntersecting: true }]);
  assert.equal(native.size, 1, 'any intersecting entry resumes observation');
  engine.dispose();
  assert.equal(observer.disconnected, 1);
  assert.equal(native.size, 0);
  observer.callback([{ isIntersecting: true }]);
  assert.equal(native.size, 0, 'a late notification after disposal changes nothing');
});

test('repeated play events never queue a second animation frame', () => {
  const frames = new Set();
  let next = 0;
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    defaultView: {
      requestAnimationFrame() { next += 1; frames.add(next); return next; }, cancelAnimationFrame(id) { frames.delete(id); },
      setTimeout() { return 0; }, clearTimeout() {},
    },
  });
  const video = Object.assign(new EventTarget(), { paused: false, ended: false, readyState: 2, currentTime: 0 });
  const watcher = watchPanoramaVideo(video, document, () => {});
  assert.equal(frames.size, 1, 'a video without native frame callbacks is polled once per display refresh');
  video.dispatchEvent(new Event('playing'));
  video.dispatchEvent(new Event('seeked'));
  assert.equal(frames.size, 1);
  watcher.dispose();
  assert.equal(frames.size, 0);
});
