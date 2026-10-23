import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, PerspectiveCamera, Scene } from 'three';
import { createPanoramaEngine } from '../dist/panorama/engine.js';
import { normalizePanoramaCamera, panoramaOrbit, panoramaPoint, projectPanoramaPoint } from '../dist/panorama/camera.js';
import { DEFAULT_ORBIT_CAMERA, orbitCameraPose } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { watchPanoramaVideo } from '../dist/panorama/video.js';

const source = () => ({ kind: 'image', image: {} });
function harness() {
  let callbacks; let options;
  const events = [];
  const viewport = { canvas: {}, scene: new Scene(), world: new Group(), pickWorld: new Group(), camera: new PerspectiveCamera(),
    orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), width: 640, height: 480, lost: false, disposed: false,
    setOrbit(value) { this.orbit = value; }, setStyle(value) { this.style = resolveLyra3dStyle(value); },
    invalidate() {}, onFrame(callback) { this.tick = callback; return () => { this.tick = undefined; }; },
    resize(width, height) { this.width = width; this.height = height; }, pickAt() { return 0; }, dispose() { this.disposed = true; },
  };
  const services = { viewport(_container, host, nextOptions) { callbacks = host; options = nextOptions; return viewport; }, inspectMedia: (value) => ({ kind: value.kind, element: value.kind === 'image' ? value.image : value.video, width: 400, height: 200 }), probe() {} };
  const engine = createPanoramaEngine(services);
  const host = { hover() {}, pick() {}, lost() { events.push('lost'); }, camera(value) { events.push(value); }, restored() { events.push('restored'); } };
  return { engine, viewport, host, events, callbacks: () => callbacks, options: () => options };
}

test('panorama angular conventions align image center/north/east with an origin camera', () => {
  const camera = normalizePanoramaCamera({ yaw: 0.8, pitch: 0.3, fieldOfView: 75 });
  const orbit = panoramaOrbit(camera); const pose = orbitCameraPose(orbit);
  for (const value of pose.position) assert.ok(Math.abs(value) < 1e-12);
  const center = projectPanoramaPoint(panoramaPoint(camera.yaw, camera.pitch), camera, { width: 640, height: 480 });
  assert.ok(Math.abs(center.x - 320) < 1e-10 && Math.abs(center.y - 240) < 1e-10);
  const north = projectPanoramaPoint(panoramaPoint(camera.yaw, camera.pitch + 0.1), camera, { width: 640, height: 480 });
  const east = projectPanoramaPoint(panoramaPoint(camera.yaw + 0.1, camera.pitch), camera, { width: 640, height: 480 });
  assert.ok(north.y < center.y); assert.ok(east.x > center.x);
  assert.equal(projectPanoramaPoint(panoramaPoint(Math.PI, 0), normalizePanoramaCamera({}), { width: 640, height: 480 }), null);
  assert.equal(normalizePanoramaCamera({ fieldOfView: Infinity }).fieldOfView, 75);
});

test('hotspot IDs/positions and silent FOV camera remain coherent across replacement', async () => {
  const { engine, viewport, host, events, options } = harness();
  const angles = new Float32Array([0, 0, 0.4, 0.2]);
  engine.setData({ source: source(), hotspotAngles: angles }, 0); angles.fill(2);
  await engine.mount({}, host); viewport.tick(0);
  assert.deepEqual(engine.positionOf(0), { x: 0, y: 0, z: -10 }); assert.equal(engine.pick(320, 240), 0);
  engine.setCamera({ yaw: 0.4, pitch: 0.2, fieldOfView: 60 }); viewport.tick(1);
  const projected = engine.project(1); assert.ok(Math.abs(projected.x - 320) < 0.001);
  assert.equal(viewport.camera.fov, 60); assert.equal(events.length, 0);
  const next = options().constrain({ ...viewport.orbit, distance: 0.5 });
  viewport.setOrbit(next); assert.equal(next.distance, 1);
  engine.focus(0); engine.fit(); assert.equal(events.length, 0);
  assert.throws(() => engine.setData({ source: source(), hotspotAngles: new Float32Array([NaN, 0]) }, 1));
  assert.equal(engine.positionOf(0).z, -10);
  const sphere = viewport.scene.children[0]; let disposed = 0; sphere.material.uniforms.panorama.value.addEventListener('dispose', () => disposed++);
  engine.setData({ source: source() }, 1); assert.equal(disposed, 1);
  engine.dispose(); engine.dispose(); assert.equal(viewport.disposed, true); assert.equal(engine.positionOf(0), null);
});

class Video extends EventTarget {
  paused = false; ended = false; readyState = 2; videoWidth = 400; videoHeight = 200;
  frames = new Map(); next = 0; canceled = [];
  requestVideoFrameCallback(callback) { const id = ++this.next; this.frames.set(id, callback); return id; }
  cancelVideoFrameCallback(id) { this.canceled.push(id); this.frames.delete(id); }
}
class OwnerDocument extends EventTarget { hidden = false }

test('native video textures use video upload without owning dimensions or frame scheduling', async () => {
  const { engine, viewport, host } = harness();
  const video = new Video(); video.ownerDocument = new OwnerDocument(); video.paused = true;
  video.width = 0; video.height = 0;
  engine.setData({ source: { kind: 'video', video } }, 0);
  await engine.mount({}, host);
  const material = viewport.scene.children[0].material;
  const texture = material.uniforms.panorama.value;
  assert.equal(texture.image, video); assert.equal(texture.isVideoTexture, true);
  assert.equal(material.defines.PANORAMA_VIDEO, 1);
  const version = texture.version;
  texture.update(); assert.ok(texture.version > version); assert.equal(video.frames.size, 0, 'a renderer refresh never schedules stationary playback');
  const beforeSeek = texture.version;
  video.dispatchEvent(new Event('seeked'));
  assert.ok(texture.version > beforeSeek); assert.equal(video.frames.size, 1, 'one request for the frame the seek presents');
  const seeked = texture.version; const [[id, presented]] = video.frames; video.frames.delete(id); presented();
  assert.ok(texture.version > seeked); assert.equal(video.frames.size, 0, 'a paused video never starts a frame loop');
  assert.equal(video.width, 0); assert.equal(video.height, 0); assert.equal(video.paused, true);
  engine.dispose(); assert.equal(video.frames.size, 0); assert.equal(video.paused, true);
});

test('renderer-requested paused video uploads stay fresh without owning playback or new frames', async () => {
  const { engine, viewport, host } = harness();
  const video = new Video(); video.ownerDocument = new OwnerDocument(); video.paused = true;
  video.currentTime = 1.4; video.seeking = false;
  engine.setData({ source: { kind: 'video', video } }, 0);
  await engine.mount({}, host);
  const texture = viewport.scene.children[0].material.uniforms.panorama.value;
  const playback = video.currentTime;
  let version = texture.version;
  // This is the renderer hook: repeated requested paints must retry a late-uploadable paused image.
  texture.update(); assert.ok(texture.version > version); version = texture.version;
  texture.update(); assert.ok(texture.version > version); version = texture.version;
  assert.equal(video.frames.size, 0); assert.equal(video.paused, true); assert.equal(video.currentTime, playback);
  video.seeking = true; texture.update(); assert.equal(texture.version, version);
  video.seeking = false; video.readyState = 1; texture.update(); assert.equal(texture.version, version);
  video.readyState = 2; video.paused = false; texture.update(); assert.equal(texture.version, version, 'playing uploads remain owned by frame observation');
  engine.dispose();
});

test('video scheduling cancels on pause/hidden/dispose and ignores retired frame callbacks', () => {
  const video = new Video(); const doc = new OwnerDocument(); let updates = 0;
  const watcher = watchPanoramaVideo(video, doc, () => updates++);
  assert.equal(video.frames.size, 1);
  const late = [...video.frames.values()][0];
  video.paused = true; video.dispatchEvent(new Event('pause'));
  assert.equal(video.frames.size, 0); late(); assert.equal(updates, 0);
  video.paused = false; video.dispatchEvent(new Event('playing')); assert.equal(video.frames.size, 1);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(video.frames.size, 0);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(video.frames.size, 1);
  watcher.setVisible(false); assert.equal(video.frames.size, 0);
  watcher.dispose(); video.dispatchEvent(new Event('playing')); assert.equal(video.frames.size, 0);
});

test('paused seek refreshes on completion and on its presented frame without starting playback or a frame loop', () => {
  const video = new Video(); video.paused = true; const doc = new OwnerDocument(); let updates = 0;
  const watcher = watchPanoramaVideo(video, doc, () => updates++);
  assert.equal(video.frames.size, 0);
  video.dispatchEvent(new Event('seeked')); assert.equal(updates, 1); assert.equal(video.frames.size, 1);
  const [[id, presented]] = video.frames; video.frames.delete(id); presented();
  assert.equal(updates, 2); assert.equal(video.frames.size, 0); assert.equal(video.paused, true);
  watcher.dispose();
});

test('video context loss and source replacement retire active fallback observation', async () => {
  const { engine, viewport, host, callbacks } = harness();
  const video = new Video(); video.currentTime = 0; video.ownerDocument = new OwnerDocument();
  const timers = new Map(), frames = new Map(); let next = 0;
  video.ownerDocument.defaultView = {
    setTimeout(callback) { const id = ++next; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { const id = ++next; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const stall = () => { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); assert.equal(frames.size, 1); };
  engine.setData({ source: { kind: 'video', video } }, 0); await engine.mount({}, host);
  stall(); const retired = [...frames.values()][0];
  viewport.lost = true; callbacks().lost('context-lost');
  assert.equal(video.frames.size + frames.size + timers.size, 0);
  retired(); assert.equal(video.frames.size + frames.size + timers.size, 0);
  viewport.lost = false; callbacks().restored();
  assert.equal(video.frames.size, 1); assert.equal(timers.size, 1);
  stall(); engine.setData({ source: source() }, 1);
  assert.equal(video.frames.size + frames.size + timers.size, 0);
  assert.equal(video.currentTime, 0); assert.equal(video.paused, false);
  engine.dispose();
});

test('failed replacement preserves revision and hotspots; disposal during rendering callback retires viewport', async () => {
  const { engine, viewport, host } = harness();
  engine.setData({ source: source(), hotspotAngles: new Float32Array([0, 0]) }, 0);
  assert.throws(() => engine.setData({ source: source(), hotspotAngles: new Float32Array([0, 2]) }, 1));
  engine.setData({ source: source(), hotspotAngles: new Float32Array([0.5, 0]) }, 1);
  await engine.mount({}, host); assert.ok(engine.positionOf(0).x > 4);
  engine.dispose();
  let engine2; let retired = 0;
  engine2 = createPanoramaEngine({ viewport(_container, callbacks) { callbacks.rendering({ software: false }); return { dispose() { retired++; } }; } });
  await engine2.mount({}, { ...host, rendering() { engine2.dispose(); } });
  assert.equal(retired, 1);
});

test('retained image dimension drift fails once and preserves caller media ownership', async () => {
  let dimensions = 400, closed = 0, lost = 0;
  const original = harness();
  const engine = createPanoramaEngine({ viewport() { return original.viewport; },
    inspectMedia(input) { return { kind: 'image', element: input.image, width: dimensions, height: 200 }; }, probe() {} });
  const image = { close() { closed++; } };
  engine.setData({ source: { kind: 'image', image }, hotspotAngles: new Float32Array([0, 0]) }, 0);
  await engine.mount({}, { ...original.host, lost() { lost++; } });
  original.viewport.tick(0); dimensions = 800; original.viewport.tick(1); original.viewport.tick(2);
  assert.equal(lost, 1); assert.equal(engine.pick(10, 10), null); assert.equal(engine.project(0), null);
  engine.dispose(); assert.equal(closed, 0);
});

test('panorama source admission rejects unloaded, oversized and unsupported native media', async () => {
  const { inspectPanoramaMedia } = await import('../dist/panorama/media.js');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'HTMLImageElement');
  class Image { complete = true; naturalWidth = 400; naturalHeight = 200; }
  Object.defineProperty(globalThis, 'HTMLImageElement', { configurable: true, value: Image });
  try {
    const image = new Image(); assert.equal(inspectPanoramaMedia({ kind: 'image', image }).width, 400);
    image.complete = false; assert.throws(() => inspectPanoramaMedia({ kind: 'image', image }));
    image.complete = true; image.naturalWidth = 8193; assert.throws(() => inspectPanoramaMedia({ kind: 'image', image }));
    image.naturalWidth = 8192; image.naturalHeight = 8192; assert.throws(() => inspectPanoramaMedia({ kind: 'image', image }));
    assert.throws(() => inspectPanoramaMedia({ kind: 'image', image: {} }));
  } finally { if (previous) Object.defineProperty(globalThis, 'HTMLImageElement', previous); else delete globalThis.HTMLImageElement; }
});

test('visibility changes cannot restart a video waiting for new frames', () => {
  const video = new Video(); const doc = new OwnerDocument();
  const watcher = watchPanoramaVideo(video, doc, () => {});
  video.dispatchEvent(new Event('waiting')); assert.equal(video.frames.size, 0);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  watcher.setVisible(false); watcher.setVisible(true); assert.equal(video.frames.size, 0);
  video.dispatchEvent(new Event('playing')); assert.equal(video.frames.size, 1); watcher.dispose();
});

test('Float32 pole hotspot endpoints remain admissible', () => {
  const { engine } = harness();
  engine.setData({ source: source(), hotspotAngles: new Float32Array([0, Math.PI / 2, 0, -Math.PI / 2]) }, 0);
  assert.equal(engine.positionOf(0).y, -10); assert.equal(engine.positionOf(1).y, 10); engine.dispose();
});
