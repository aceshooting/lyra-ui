import { createEngine } from '@aceshooting/lyra-3d/panorama';
import { DEFAULT_LYRA_3D_STYLE } from '@aceshooting/lyra-3d/core';

const WIDTH = 640;
const HEIGHT = 480;
const HOME = { yaw: 0, pitch: 0, fieldOfView: 75 };
let active;
const videoDiagnostics = new WeakMap();
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const skip = (reason) => ({ passed: false, skipped: reason });
async function until(predicate, message, timeout = 10000) {
  const deadline = performance.now() + timeout;
  while (!predicate()) { if (performance.now() >= deadline) throw new Error(typeof message === 'function' ? message() : message); await wait(20); }
}
function nativeVideoState(video) {
  const rect = video.getBoundingClientRect(); const style = getComputedStyle(video);
  const quality = video.getVideoPlaybackQuality?.();
  const ranges = (value) => Array.from({ length: value.length }, (_, index) => [value.start(index), value.end(index)]);
  return { connected: video.isConnected, parent: video.parentElement?.localName, visibility: document.visibilityState,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport: [innerWidth, innerHeight],
    display: style.display, cssVisibility: style.visibility, opacity: style.opacity,
    currentTime: video.currentTime, paused: video.paused, seeking: video.seeking, ended: video.ended,
    readyState: video.readyState, networkState: video.networkState, playbackRate: video.playbackRate,
    width: video.videoWidth, height: video.videoHeight, buffered: ranges(video.buffered), seekable: ranges(video.seekable),
    totalVideoFrames: quality?.totalVideoFrames, droppedVideoFrames: quality?.droppedVideoFrames,
    error: video.error?.code, events: videoDiagnostics.get(video)?.events };
}
const emptyState = () => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
const near = (a, b, tolerance = 0.1) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
function atlas() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Panorama atlas needs canvas 2D');
  ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 1024, 512);
  for (const [color, x] of [['#00ff00', 192], ['#0000ff', 448], ['#00ffff', 704]]) {
    ctx.fillStyle = color; ctx.fillRect(x, 128, 128, 256);
  }
  ctx.fillStyle = '#ffff00'; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 384, 1024, 128);
  return canvas;
}
function cleanupAll(actions) {
  let failed = false; let failure;
  for (const action of actions) {
    try { action(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
}
function releaseVideo(video) {
  const source = video.src;
  const diagnostic = videoDiagnostics.get(video);
  cleanupAll([() => diagnostic?.stop(), () => videoDiagnostics.delete(video), () => video.pause(), () => video.removeAttribute('src'), () => video.load(), () => video.remove(), () => URL.revokeObjectURL(source)]);
}
function clearRecord(record) {
  cleanupAll([
    () => record.engine?.dispose(),
    ...(record.listeners ?? []).map(([type, listener]) => () => record.container?.removeEventListener(type, listener, true)),
    ...(record.releases ?? []),
    () => record.container?.remove(),
  ]);
}
export function cleanupPanorama() { const record = active; active = undefined; if (record) clearRecord(record); }
function createContainer() {
  cleanupPanorama();
  const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px`;
  document.body.replaceChildren(container);
  return container;
}
async function mount(source = { kind: 'image', image: atlas() }, extras = {}, preparedContainer) {
  const container = preparedContainer ?? createContainer();
  if (!container.isConnected) throw new Error('Panorama fixture container must remain connected');
  const record = { container, source, engine: createEngine(), releases: [], listeners: [],
    calls: { camera: [], hover: [], pick: [], lost: [], restored: 0 }, trusted: { down: 0, move: 0, up: 0 }, checkpoints: {} };
  active = record;
  for (const [type, key] of [['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up']]) {
    const listener = (event) => { if (event.isTrusted) record.trusted[key] += 1; if (key === 'down') record.pointerId = event.pointerId; };
    container.addEventListener(type, listener, true); record.listeners.push([type, listener]);
  }
  record.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, pointSize: 24, palette: ['#00ff00'], accent: '#ff0000', focus: '#00ffff', reducedMotion: true });
  record.engine.setCamera(HOME);
  record.engine.setData({ source, ...extras }, 0);
  await record.engine.mount(container, {
    hover: (item) => record.calls.hover.push(item), pick: (item, mods) => record.calls.pick.push({ item, ...mods }),
    camera: (camera) => record.calls.camera.push(camera), lost: (reason) => record.calls.lost.push(reason),
    restored: () => { record.calls.restored += 1; },
  });
  record.engine.resize(WIDTH, HEIGHT);
  record.canvas = container.querySelector('canvas');
  record.gl = record.canvas?.getContext('webgl2');
  if (!record.gl) throw new Error('Panorama did not mount actual WebGL2');
  await frame();
  return record;
}
async function read(record, point = { x: WIDTH / 2, y: HEIGHT / 2 }, state = emptyState()) {
  record.engine.setState(state);
  return new Promise((resolve) => requestAnimationFrame(() => {
    const buffer = new Uint8Array(4);
    record.gl.readPixels(Math.floor(point.x), HEIGHT - 1 - Math.floor(point.y), 1, 1, record.gl.RGBA, record.gl.UNSIGNED_BYTE, buffer);
    resolve([...buffer]);
  }));
}
// Read only after actual draws; observing media must never request an engine render.
function observeNativeDraws(record, media) {
  const { gl, canvas } = record;
  let latest; let sequence = 0;
  const cleanups = [];
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const descriptor = Object.getOwnPropertyDescriptor(gl, name);
    const original = gl[name];
    Object.defineProperty(gl, name, { configurable: true, writable: true, value: (...args) => {
      Reflect.apply(original, gl, args);
      if (gl.isContextLost() || gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) !== null || gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) !== null) return;
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      latest = { sequence: ++sequence, mediaTime: media.currentTime, pixels };
    } });
    cleanups.push(() => { if (descriptor) Object.defineProperty(gl, name, descriptor); else Reflect.deleteProperty(gl, name); });
  }
  return { get latest() { return latest; }, stop() { for (const cleanup of cleanups.splice(0)) cleanup(); } };
}
function centerPixels(record, pixels) {
  const offset = ((record.canvas.height - 1 - Math.floor(record.canvas.height / 2)) * record.canvas.width + Math.floor(record.canvas.width / 2)) * 4;
  return [...pixels.slice(offset, offset + 4)];
}
const colorMatches = (actual, expected, tolerance = 35) => expected.every((value, channel) => Math.abs(actual[channel] - value) <= tolerance);
const samples = [
  { camera: HOME, color: [0, 0, 255] },
  { camera: { ...HOME, yaw: Math.PI / 2 }, color: [0, 255, 255] },
  { camera: { ...HOME, yaw: -Math.PI / 2 }, color: [0, 255, 0] },
  { camera: { ...HOME, pitch: Math.PI / 3 }, color: [255, 255, 0] },
  { camera: { ...HOME, pitch: -Math.PI / 3 }, color: [255, 0, 255] },
];
async function orientation(record) {
  const observed = [];
  for (const sample of samples) {
    record.engine.setCamera(sample.camera);
    observed.push(await read(record));
  }
  return { passed: observed.every((value, index) => colorMatches(value, samples[index].color)) && record.calls.camera.length === 0, observed };
}
async function loadedImage(canvas) {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Atlas image decode failed')); image.src = canvas.toDataURL('image/png'); });
  image.onload = null; image.onerror = null;
  return image;
}

async function videoFixture() {
  const video = document.createElement('video');
  const events = []; const eventTypes = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'play', 'playing', 'waiting', 'stalled', 'seeking', 'seeked', 'timeupdate', 'pause', 'ended', 'error'];
  const started = performance.now();
  const observe = (event) => {
    events.push({ type: event.type, elapsed: Math.round(performance.now() - started), time: video.currentTime,
      connected: video.isConnected, paused: video.paused, seeking: video.seeking, readyState: video.readyState });
    if (events.length > 64) events.shift();
  };
  eventTypes.forEach(type => video.addEventListener(type, observe));
  videoDiagnostics.set(video, { events, stop: () => eventTypes.forEach(type => video.removeEventListener(type, observe)) });
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.loop = true;
  if (!video.canPlayType('video/mp4')) return { unsupported: 'Native MP4 decoder unavailable' };
  // A fixture-owned blob gives native media a seekable resource even when the asset server
  // does not implement HTTP byte ranges. The engine still receives the original native video.
  const response = await fetch(new URL('./panorama-video.mp4', import.meta.url));
  if (!response.ok) throw new Error('Native video fixture request failed');
  const bytes = await response.arrayBuffer();
  const container = createContainer();
  // Establish the native presentation surface before loading. Keep this exact connected
  // subtree when mounting the engine so decoding does not start in a detached media pipeline.
  video.style.cssText = `position:absolute;left:${WIDTH + 8}px;top:0;width:160px;height:90px;pointer-events:none`;
  video.setAttribute('aria-hidden', 'true'); container.append(video);
  video.src = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
  video.load();
  try { await until(() => (video.readyState >= 2 && events.some(event => event.type === 'loadeddata')) || video.error, 'Native video fixture did not decode'); }
  catch (error) { releaseVideo(video); container.remove(); throw error; }
  if (video.error) {
    const code = video.error.code; releaseVideo(video); container.remove();
    throw new Error(`Native MP4 fixture failed with media error ${code}`);
  }
  if (!Number.isFinite(video.duration) || video.duration < 0.2) { releaseVideo(video); container.remove(); throw new Error('Panorama fixture must be finite and seekable'); }
  if (!events.some(event => event.type === 'loadeddata') || events.some(event => !event.connected)) {
    releaseVideo(video); container.remove(); throw new Error('Native video must load and decode in its connected presentation surface');
  }
  return { video, container };
}
async function seek(video, time) {
  if (Math.abs(video.currentTime - time) < 0.001) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Native seek timed out: ${JSON.stringify({ target: time, native: nativeVideoState(video) })}`)); }, 10000);
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', failed); };
    const done = () => {
      cleanup();
      if (video.readyState < 2 || Math.abs(video.currentTime - time) > 0.01) reject(new Error(`Native seek did not reach ${time}: ${video.currentTime}`));
      else resolve();
    };
    const failed = () => { cleanup(); reject(new Error('Native seek failed')); };
    video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', failed, { once: true });
    try { video.currentTime = time; } catch (error) { cleanup(); reject(error); }
  });
  // Pixel assertions below establish presentation without requiring an optional notification API.
  await frame(); await frame();
}
function sourcePixels(video, width = 64, height = 32) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  try { const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, width, height); return ctx.getImageData(0, 0, width, height).data; }
  finally { canvas.width = 1; canvas.height = 1; }
}
function sampleVideo(video, u, v) {
  const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  try {
    const ctx = canvas.getContext('2d');
    // Capture the presented full frame before selecting the pixel; native video crop paths
    // need not share the same frame cache as full-frame Canvas2D or WebGL uploads.
    ctx.drawImage(video, 0, 0);
    return [...ctx.getImageData(Math.min(canvas.width - 1, Math.max(0, Math.floor(u * canvas.width))), Math.min(canvas.height - 1, Math.max(0, Math.floor(v * canvas.height))), 1, 1).data];
  } finally { canvas.width = 1; canvas.height = 1; }
}
function ownVideo(record, video) {
  record.releases.push(() => releaseVideo(video));
  if (!video.isConnected || video.parentElement !== record.container) throw new Error('Engine mounting detached the native video fixture');
}

export const panoramaCases = {
  async 'panorama-canvas-orientation'() { return orientation(await mount()); },
  async 'panorama-image-orientation'() {
    const image = await loadedImage(atlas());
    const record = await mount({ kind: 'image', image });
    record.releases.push(() => image.removeAttribute('src'));
    return orientation(record);
  },
  async 'panorama-bitmap-orientation-ownership'() {
    if (typeof createImageBitmap !== 'function') return skip('Native ImageBitmap unavailable');
    const bitmap = await createImageBitmap(atlas(), { imageOrientation: 'none' });
    let record;
    try {
      record = await mount({ kind: 'image', image: bitmap });
      const result = await orientation(record);
      record.engine.dispose();
      return { ...result, passed: result.passed && bitmap.width === 1024 && bitmap.height === 512, sourceRetained: bitmap.width === 1024 };
    } finally { bitmap.close(); }
  },
  async 'panorama-hotspot-state-camera'() {
    const record = await mount(undefined, { hotspotAngles: new Float32Array([0, 0, 0.35, 0.2, -0.35, -0.2]), hotspotSizes: new Float32Array([24, 24, 0]) });
    const points = [0, 1, 2].map((item) => record.engine.project(item));
    const picked = points.map((point) => record.engine.pick(point.x, point.y));
    const resting = await read(record, points[0]);
    const selected = await read(record, points[0], { ...emptyState(), selected: new Set([0]) });
    const focused = record.engine.focus(1, 40);
    const centered = record.engine.project(1);
    await read(record);
    const reset = record.engine.fit();
    await read(record);
    return { passed: JSON.stringify(picked) === '[0,1,null]' && colorMatches(resting, [0, 255, 0]) && colorMatches(selected, [255, 0, 0]) &&
      near(centered.x, WIDTH / 2) && near(centered.y, HEIGHT / 2) && focused.fieldOfView === 40 && reset.yaw === 0 && reset.pitch === 0 &&
      record.calls.camera.length === 0 && record.engine.positionOf(99) === null, picked, resting, selected, centered, reset };
  },
  async 'panorama-context-restore-dispose'() {
    const record = await mount(undefined, { hotspotAngles: new Float32Array([0.35, 0.2]) });
    const extension = record.gl.getExtension('WEBGL_lose_context');
    if (!extension) return skip('WEBGL_lose_context unavailable');
    extension.loseContext();
    await until(() => record.calls.lost.includes('context-lost'), 'Panorama did not report context loss');
    const lostPick = record.engine.pick(320, 240);
    await wait(100); extension.restoreContext();
    await until(() => record.calls.restored === 1, 'Panorama did not report restored context');
    const restored = await read(record);
    const hotspot = record.engine.project(0);
    const picked = record.engine.pick(hotspot.x, hotspot.y);
    const before = JSON.stringify(record.calls);
    record.engine.dispose(); record.engine.dispose();
    await until(() => record.gl.isContextLost(), 'Panorama disposal did not release WebGL');
    await frame();
    return { passed: lostPick === null && colorMatches(restored, [0, 0, 255]) && picked === 0 && !record.canvas.isConnected &&
      record.engine.positionOf(0) === null && record.engine.project(0) === null && JSON.stringify(record.calls) === before,
      restored, picked, contextLost: record.gl.isContextLost() };
  },
  async 'panorama-native-video-paused-seek'() {
    let fixture;
    try { fixture = await videoFixture(); }
    catch (error) { return { passed: false, phase: 'native-video-fixture', error: String(error?.message ?? error) }; }
    if (fixture.unsupported) return skip(fixture.unsupported);
    const video = fixture.video;
    let record, draws;
    try {
      video.pause();
      record = await mount({ kind: 'video', video }, {}, fixture.container); ownVideo(record, video);
      await seek(video, 0);
      const initialTime = video.currentTime;
      const earlier = sourcePixels(video);
      const laterTime = Math.min(video.duration - 0.05, video.duration * 0.7);
      await seek(video, laterTime);
      const later = sourcePixels(video);
      let best = 0; let delta = 0; let unrestrictedDelta = 0; let flatSamples = 0;
      for (let row = 2; row < 30; row += 1) for (let column = 1; column < 63; column += 1) {
        const offset = (row * 64 + column) * 4;
        const difference = Math.max(...[0, 1, 2].map((channel) => Math.abs(earlier[offset + channel] - later[offset + channel])));
        unrestrictedDelta = Math.max(unrestrictedDelta, difference);
        // Prefer broad flat patches so codec/chroma interpolation at a moving edge cannot
        // masquerade as a stale texture or make a correct upload depend on subpixel sampling.
        const flat = [earlier, later].every((image) => [-64, -1, 1, 64].every((neighbor) => {
          const other = offset + neighbor * 4;
          return [0, 1, 2].every((channel) => Math.abs(image[offset + channel] - image[other + channel]) < 35);
        }));
        if (flat) flatSamples += 1;
        if (flat && difference > delta) { delta = difference; best = row * 64 + column; }
      }
      if (delta <= 100) return { passed: false, error: 'Video fixture has insufficient per-channel frame change to discriminate seek upload',
        delta, unrestrictedDelta, flatSamples, initialTime, laterTime, currentTime: video.currentTime, duration: video.duration,
        width: video.videoWidth, height: video.videoHeight, paused: video.paused, readyState: video.readyState,
        earlierProbe: [...earlier.slice((25 * 64 + 58) * 4, (25 * 64 + 58) * 4 + 4)],
        laterProbe: [...later.slice((25 * 64 + 58) * 4, (25 * 64 + 58) * 4 + 4)] };
      const u = (best % 64 + 0.5) / 64; const v = (Math.floor(best / 64) + 0.5) / 32;
      await seek(video, initialTime);
      draws = observeNativeDraws(record, video);
      const camera = { yaw: (u - 0.5) * Math.PI * 2, pitch: (0.5 - v) * Math.PI, fieldOfView: 75 };
      record.engine.setCamera(camera);
      const describeDraw = (message, expected) => () => `${message}: ${JSON.stringify({
        u, v, expected, source: sampleVideo(video, u, v),
        actual: draws.latest && centerPixels(record, draws.latest.pixels),
        mediaTime: draws.latest?.mediaTime, sequence: draws.latest?.sequence, camera,
      })}`;
      const earlierExpected = sampleVideo(video, u, v);
      await until(() => draws.latest && near(draws.latest.mediaTime, initialTime, 0.01) &&
        colorMatches(centerPixels(record, draws.latest.pixels), earlierExpected.slice(0, 3), 45),
      describeDraw('Initial paused video did not draw the expected pixels', earlierExpected), 5000);
      const earlierActual = centerPixels(record, draws.latest.pixels);
      const sequence = draws.latest.sequence;
      // Keep the camera fixed across the discriminating seek. A stale old framebuffer must
      // be outside the exact tolerance used to accept the newly uploaded source frame.
      await seek(video, laterTime);
      const callerTime = video.currentTime;
      const expected = sampleVideo(video, u, v);
      await until(() => draws.latest && draws.latest.sequence > sequence && near(draws.latest.mediaTime, callerTime, 0.01) &&
        colorMatches(centerPixels(record, draws.latest.pixels), expected.slice(0, 3), 45),
      describeDraw('Automatic paused video seek did not draw the updated pixels', expected), 5000);
      const actual = centerPixels(record, draws.latest.pixels);
      const earlierMatches = colorMatches(earlierActual, earlierExpected.slice(0, 3), 45);
      const staleRejected = !colorMatches(earlierActual, expected.slice(0, 3), 45);
      const pixelsChanged = actual.slice(0, 3).some((value, channel) => Math.abs(value - earlierActual[channel]) > 1);
      return { passed: video.paused && near(video.currentTime, callerTime, 0.001) && callerTime > initialTime &&
        earlierMatches && staleRejected && pixelsChanged && colorMatches(actual, expected.slice(0, 3), 45) && record.calls.lost.length === 0,
        earlierExpected, earlierActual, expected, actual, delta, staleRejected, pixelsChanged, paused: video.paused, currentTime: video.currentTime };
    } catch (error) {
      return { passed: false, error: String(error?.message ?? error), currentTime: video.currentTime, duration: video.duration,
        paused: video.paused, readyState: video.readyState, seeking: video.seeking, native: nativeVideoState(video) };
    } finally { draws?.stop(); if (!record) { releaseVideo(video); fixture.container.remove(); } }
  },
  async 'panorama-native-video-playing-pixels'() {
    const fixture = await videoFixture();
    if (fixture.unsupported) return skip(fixture.unsupported);
    const video = fixture.video; video.loop = false;
    let record, draws;
    try {
      record = await mount({ kind: 'video', video }, {}, fixture.container); ownVideo(record, video);
      // The native fixture's moving color strip occupies its lower third; the center is static.
      // Keep that strip in view throughout playback so consecutive frames discriminate uploads.
      record.engine.setCamera({ ...HOME, pitch: -Math.PI * 0.3 });
      draws = observeNativeDraws(record, video);
      await video.play();
      await until(() => draws.latest && draws.latest.mediaTime > 0.35, 'Automatic native playback did not draw beyond startup', 5000);
      let previous = draws.latest;
      let changed = 0; let maxDelta = 0; const transitions = [];
      const deadline = performance.now() + 3500;
      while (!video.ended && performance.now() < deadline) {
        await wait(100); const current = draws.latest;
        if (!current || current.sequence <= previous.sequence) continue;
        const pixels = current.pixels; let count = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(pixels[offset + channel] - previous.pixels[offset + channel])));
          if (delta > 100) count++; maxDelta = Math.max(maxDelta, delta);
        }
        changed = Math.max(changed, count);
        if (count > 100 && current.mediaTime > previous.mediaTime + 0.1) {
          transitions.push({ from: previous.mediaTime, to: current.mediaTime, changed: count });
          previous = current;
        }
      }
      return { passed: transitions.length >= 2 && changed > 100 && maxDelta > 100 && video.currentTime > 1 && record.calls.lost.length === 0,
        changed, maxDelta, transitions, currentTime: video.currentTime, native: nativeVideoState(video) };
    } finally { draws?.stop(); if (!record) { releaseVideo(video); fixture.container.remove(); } }
  },
  async 'panorama-native-video-observation-ownership'() {
    let fixture;
    try { fixture = await videoFixture(); }
    catch (error) { return { passed: false, phase: 'native-video-fixture', error: String(error?.message ?? error) }; }
    if (fixture.unsupported) return skip(fixture.unsupported);
    const video = fixture.video;
    if (typeof video.requestVideoFrameCallback !== 'function' || typeof video.cancelVideoFrameCallback !== 'function') {
      releaseVideo(video); fixture.container.remove(); return skip('Native video frame callbacks unavailable');
    }
    const requestDescriptor = Object.getOwnPropertyDescriptor(video, 'requestVideoFrameCallback');
    const cancelDescriptor = Object.getOwnPropertyDescriptor(video, 'cancelVideoFrameCallback');
    const nativeRequest = video.requestVideoFrameCallback.bind(video); const nativeCancel = video.cancelVideoFrameCallback.bind(video);
    const pending = new Set(); let requests = 0; let delivered = 0; let cancellations = 0; let mediaTime;
    video.requestVideoFrameCallback = (callback) => {
      requests += 1;
      const id = nativeRequest((time, metadata) => { pending.delete(id); delivered += 1; mediaTime = metadata.mediaTime; callback(time, metadata); });
      pending.add(id); return id;
    };
    video.cancelVideoFrameCallback = (id) => { if (pending.delete(id)) cancellations += 1; nativeCancel(id); };
    let record;
    try {
      record = await mount({ kind: 'video', video }, {}, fixture.container); ownVideo(record, video);
      await video.play();
      await until(() => video.currentTime > 0.3 && pending.size > 0, () => `Engine did not observe playing video: ${JSON.stringify(nativeVideoState(video))}`);
      const beforePause = cancellations;
      video.pause();
      await until(() => pending.size === 0, 'Pause did not cancel the pending native callback');
      const pauseCancelled = cancellations > beforePause;
      const pausedRequests = requests;
      await wait(100);
      if (requests !== pausedRequests) throw new Error('Paused video kept requesting frames');
      await video.play();
      await until(() => pending.size > 0, 'Playback did not resume frame observation');
      const beforeReplacement = cancellations;
      record.engine.setData({ source: { kind: 'image', image: atlas() } }, 1);
      const replacementCancelled = pending.size === 0 && cancellations > beforeReplacement;
      const playingAfterReplacement = !video.paused;
      record.engine.setData({ source: { kind: 'video', video } }, 2);
      await until(() => pending.size > 0, 'Restored caller video was not observed');
      const beforeDispose = cancellations;
      record.engine.dispose();
      const disposalCancelled = pending.size === 0 && cancellations > beforeDispose;
      return { passed: pauseCancelled && replacementCancelled && disposalCancelled && playingAfterReplacement,
        requests, delivered, nativeDelivery: delivered > 1 ? 'observed' : 'unqualified', cancellations, pauseCancelled, replacementCancelled, disposalCancelled, playingAfterReplacement };
    } catch (error) {
      return { passed: false, error: String(error?.message ?? error), requests, delivered, cancellations, pending: pending.size, mediaTime,
        currentTime: video.currentTime, duration: video.duration, paused: video.paused, readyState: video.readyState, seeking: video.seeking, lost: record?.calls.lost, native: nativeVideoState(video) };
    } finally {
      cleanupAll([
        cleanupPanorama,
        () => { if (!record) { releaseVideo(video); fixture.container.remove(); } },
        () => { if (requestDescriptor) Object.defineProperty(video, 'requestVideoFrameCallback', requestDescriptor); else delete video.requestVideoFrameCallback; },
        () => { if (cancelDescriptor) Object.defineProperty(video, 'cancelVideoFrameCallback', cancelDescriptor); else delete video.cancelVideoFrameCallback; },
      ]);
    }
  },
};

export function panoramaPointerCheckpoint(name, action) {
  if (!active || action !== 'moved') throw new Error(`Unknown panorama checkpoint ${name}:${action}`);
  active.checkpoints.captured = active.canvas.hasPointerCapture(active.pointerId);
  return active.checkpoints;
}
export const panoramaPointerCases = {
  async 'panorama-orbit'() {
    await mount();
    return { setup: { start: { x: 320, y: 400 }, end: { x: 410, y: 360 } } };
  },
  async 'panorama-orbit:verify'() {
    const record = active;
    await read(record);
    const camera = record.calls.camera.at(-1);
    return { passed: record.trusted.down > 0 && record.trusted.move > 0 && record.trusted.up > 0 && record.checkpoints.captured &&
      !record.canvas.hasPointerCapture(record.pointerId) && record.calls.pick.length === 0 && camera &&
      Math.abs(camera.yaw) > 0.1 && Math.abs(camera.pitch) > 0.01 && camera.fieldOfView >= 20 && camera.fieldOfView <= 100,
      camera, trusted: record.trusted, captured: record.checkpoints.captured };
  },
  async 'panorama-hotspot-click'() {
    const record = await mount(undefined, { hotspotAngles: new Float32Array([0, 0, 0.35, 0.2]) });
    const first = record.engine.project(0); const second = record.engine.project(1);
    return { setup: { hover: first, click: first, double: second, empty: { x: 6, y: 6 } } };
  },
  async 'panorama-hotspot-click:verify'() {
    const record = active;
    await read(record);
    const picks = record.calls.pick;
    return { passed: record.trusted.down >= 4 && record.trusted.up >= 4 && record.calls.hover.includes(0) &&
      picks.some((entry) => entry.item === 0 && !entry.double) && picks.some((entry) => entry.item === 1 && entry.double) &&
      picks.some((entry) => entry.item === null && entry.shift) && record.calls.camera.length === 0,
      picks, hover: record.calls.hover, trusted: record.trusted };
  },
};
