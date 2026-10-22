import assert from 'node:assert/strict';
import test from 'node:test';
import { watchPanoramaVideo } from '../dist/panorama/video.js';

function fixture(update = () => {}) {
  const frames = new Map(), timers = new Map(), native = new Map(); let next = 0;
  const video = Object.assign(new EventTarget(), { paused: false, ended: false, readyState: 2, currentTime: 0,
    requestVideoFrameCallback(callback) { const id = ++next; native.set(id, callback); return id; },
    cancelVideoFrameCallback(id) { native.delete(id); },
  });
  const document = Object.assign(new EventTarget(), { hidden: false, defaultView: {
    requestAnimationFrame(callback) { const id = ++next; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { assert.equal(delay, 250); const id = ++next; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  } });
  const fire = queue => { const [id, callback] = queue.entries().next().value; queue.delete(id); callback(); };
  const watcher = watchPanoramaVideo(video, document, update);
  return { video, document, watcher, frames, timers, native, fire };
}

test('stalled native observation falls back, deduplicates time and recovers native scheduling', () => {
  let updates = 0; const f = fixture(() => updates++);
  assert.equal(f.native.size, 1); assert.equal(f.timers.size, 1); assert.equal(f.frames.size, 0);
  f.fire(f.timers); assert.equal(f.frames.size, 1); assert.equal(f.native.size, 1);
  f.video.currentTime = 0.3; f.fire(f.frames); assert.equal(updates, 1);
  f.fire(f.frames); assert.equal(updates, 1);
  f.video.currentTime = 0.4; f.fire(f.frames); assert.equal(updates, 2);
  f.fire(f.native); assert.equal(updates, 3); assert.equal(f.frames.size, 0);
  assert.equal(f.native.size, 1); assert.equal(f.timers.size, 1);
  f.watcher.dispose(); assert.equal(f.native.size + f.frames.size + f.timers.size, 0);
});

test('every observation stop cancels watchdog, native and fallback handles and retires late callbacks', () => {
  for (const stop of ['pause', 'waiting', 'ended', 'emptied', 'hidden', 'invisible', 'dispose']) {
    let updates = 0; const f = fixture(() => updates++);
    const lateTimer = [...f.timers.values()][0]; f.fire(f.timers);
    const lateFrame = [...f.frames.values()][0], lateNative = [...f.native.values()][0];
    if (stop === 'hidden') { f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); }
    else if (stop === 'invisible') f.watcher.setVisible(false);
    else if (stop === 'dispose') f.watcher.dispose();
    else f.video.dispatchEvent(new Event(stop));
    assert.equal(f.native.size + f.frames.size + f.timers.size, 0, stop);
    lateTimer(); lateFrame(); lateNative(); assert.equal(updates, 0, stop);
    assert.equal(f.native.size + f.frames.size + f.timers.size, 0, stop);
    f.watcher.dispose();
  }
});

test('fallback update can dispose observation without rescheduling any callback', () => {
  const f = fixture(() => f.watcher.dispose());
  f.fire(f.timers); f.video.currentTime = 0.3; f.fire(f.frames);
  assert.equal(f.native.size + f.frames.size + f.timers.size, 0);
});

test('native recovery retires canceled fallback callbacks and reentrant native disposal', () => {
  let updates = 0; const f = fixture(() => updates++);
  f.fire(f.timers); const late = [...f.frames.values()][0];
  f.fire(f.native); const recovered = updates;
  f.video.currentTime = 0.5; late();
  assert.equal(updates, recovered); assert.equal(f.frames.size, 0); assert.equal(f.native.size, 1);
  f.watcher.dispose();
  const g = fixture(() => g.watcher.dispose());
  g.fire(g.native); assert.equal(g.native.size + g.frames.size + g.timers.size, 0);
});

test('resuming after waiting owns one callback and watchdog without mutating playback', () => {
  const f = fixture(); f.fire(f.timers);
  f.video.dispatchEvent(new Event('waiting'));
  f.watcher.setVisible(false); f.watcher.setVisible(true);
  assert.equal(f.native.size + f.frames.size + f.timers.size, 0);
  f.video.currentTime = 1.2; f.video.dispatchEvent(new Event('playing'));
  f.video.dispatchEvent(new Event('playing'));
  assert.equal(f.native.size, 1); assert.equal(f.timers.size, 1); assert.equal(f.frames.size, 0);
  assert.equal(f.video.currentTime, 1.2); assert.equal(f.video.paused, false);
  f.watcher.dispose();
});

test('missing native frame API uses only animation frames and preserves caller playback', () => {
  const f = fixture(); f.watcher.dispose();
  delete f.video.requestVideoFrameCallback; delete f.video.cancelVideoFrameCallback;
  const watcher = watchPanoramaVideo(f.video, f.document, () => {});
  assert.equal(f.frames.size, 1); assert.equal(f.timers.size, 0); assert.equal(f.video.paused, false);
  watcher.dispose(); assert.equal(f.frames.size, 0); assert.equal(f.video.currentTime, 0);
});
