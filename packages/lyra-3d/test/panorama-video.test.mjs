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
  for (const stop of ['pause', 'waiting', 'ended', 'emptied', 'seeking', 'hidden', 'invisible', 'dispose']) {
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

test('native pause retires both pending and already-delivered frame requests without updates or rescheduling', () => {
  for (const deliveryBeforePauseEvent of [false, true]) {
    let updates = 0; const f = fixture(() => updates++);
    const cancelled = [];
    const cancel = f.video.cancelVideoFrameCallback;
    f.video.cancelVideoFrameCallback = id => {
      if (f.native.has(id)) cancelled.push(id);
      cancel(id);
    };
    try {
      assert.equal(f.native.size, 1);
      f.video.paused = true;
      if (deliveryBeforePauseEvent) {
        f.fire(f.native);
        assert.equal(f.native.size, 0, 'native delivery fulfills the request before the pause event');
        assert.equal(updates, 0, 'the paused-state check rejects a frame delivered before the stop event');
      }
      f.video.dispatchEvent(new Event('pause'));
      assert.equal(f.native.size + f.frames.size + f.timers.size, 0, 'the native pause event releases all remaining observation');
      assert.equal(cancelled.length, deliveryBeforePauseEvent ? 0 : 1,
        'an already fulfilled request needs no pending-request cancellation');
      assert.equal(updates, 0);
      f.video.paused = false; f.video.dispatchEvent(new Event('playing'));
      assert.equal(f.native.size, 1, 'playback can resume observation after either retirement path');
      assert.equal(f.timers.size, 1);
      assert.equal(updates, 1);
    } finally { f.watcher.dispose(); }
    assert.equal(f.native.size + f.frames.size + f.timers.size, 0);
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

test('a paused seek updates again once its frame is presented and resumes playback observation', () => {
  let updates = 0; const f = fixture(() => updates++);
  f.video.dispatchEvent(new Event('seeked')); assert.equal(f.native.size, 1, 'a playing seek keeps its single frame loop');
  updates = 0; f.video.paused = true; f.video.dispatchEvent(new Event('pause'));
  assert.equal(f.native.size + f.frames.size + f.timers.size, 0);
  f.video.currentTime = 1.4; f.video.dispatchEvent(new Event('seeked'));
  assert.equal(updates, 1, 'the seek completion updates immediately');
  assert.equal(f.native.size, 1, 'and waits for the frame the seek presents');
  f.video.dispatchEvent(new Event('seeked')); assert.equal(f.native.size, 1, 'repeated seeks share one request');
  const late = [...f.native.values()][0]; f.video.dispatchEvent(new Event('waiting'));
  late(); assert.equal(updates, 2, 'a stopped watcher ignores the late frame');
  f.video.dispatchEvent(new Event('seeked')); updates = 1;
  f.fire(f.native); assert.equal(updates, 2);
  assert.equal(f.native.size + f.frames.size + f.timers.size, 0, 'a paused video schedules nothing more');
  f.video.dispatchEvent(new Event('seeked')); f.video.paused = false; f.video.dispatchEvent(new Event('play'));
  f.fire(f.native); assert.equal(f.native.size, 1, 'playback observation continues from the presented frame');
  f.watcher.dispose(); assert.equal(f.native.size + f.frames.size + f.timers.size, 0);
});

test('a paused seek without the native frame API updates on the next animation frame', () => {
  const f = fixture(); f.watcher.dispose();
  delete f.video.requestVideoFrameCallback; delete f.video.cancelVideoFrameCallback;
  let updates = 0; const watcher = watchPanoramaVideo(f.video, f.document, () => updates++);
  f.frames.clear(); f.video.paused = true; f.video.dispatchEvent(new Event('pause'));
  f.video.dispatchEvent(new Event('seeked')); assert.equal(updates, 1); assert.equal(f.frames.size, 1);
  f.video.dispatchEvent(new Event('seeked')); assert.equal(updates, 2); assert.equal(f.frames.size, 1, 'repeated seeks share one frame');
  updates = 1; f.fire(f.frames); assert.equal(updates, 2); assert.equal(f.frames.size, 0);
  f.video.dispatchEvent(new Event('seeked')); const late = [...f.frames.values()][0];
  f.video.dispatchEvent(new Event('emptied')); late(); assert.equal(updates, 3, 'a stopped watcher ignores the late frame');
  watcher.dispose(); assert.equal(f.frames.size, 0);
});

test('a paused frame callback during a later seek waits until the video is readable', () => {
  let updates = 0; const f = fixture(() => updates++);
  try {
    f.video.paused = true; f.video.dispatchEvent(new Event('pause'));
    f.video.currentTime = 1.4; f.video.dispatchEvent(new Event('seeked'));
    assert.equal(updates, 1); assert.equal(f.native.size, 1);
    f.video.currentTime = 0; f.video.readyState = 1; f.video.seeking = true;
    f.fire(f.native);
    assert.equal(updates, 1, 'a frame from the previous seek must not upload unreadable media');
    assert.equal(f.native.size, 0);
    f.video.readyState = 2; f.video.seeking = false; f.video.dispatchEvent(new Event('seeked'));
    assert.equal(updates, 2, 'the completed seek uploads its readable frame');
    assert.equal(f.native.size, 1);
    f.fire(f.native);
    assert.equal(updates, 3, 'presentation of the completed seek still refreshes the texture');
  } finally { f.watcher.dispose(); }
});

test('starting a seek retires paused frame observation and ignores its late callback', () => {
  let updates = 0; const f = fixture(() => updates++);
  try {
    f.video.paused = true; f.video.dispatchEvent(new Event('pause'));
    f.video.currentTime = 1.4; f.video.dispatchEvent(new Event('seeked'));
    const late = [...f.native.values()][0];
    f.video.seeking = true; f.video.dispatchEvent(new Event('seeking'));
    assert.equal(f.native.size + f.frames.size + f.timers.size, 0);
    late(); assert.equal(updates, 1);
    f.video.currentTime = 0; f.video.seeking = false; f.video.dispatchEvent(new Event('seeked'));
    assert.equal(updates, 2); assert.equal(f.native.size, 1);
  } finally { f.watcher.dispose(); }
});

test('a stalled paused frame notification refreshes once and retires its native request', () => {
  let updates = 0; const f = fixture(() => updates++);
  try {
    f.video.paused = true; f.video.dispatchEvent(new Event('pause'));
    f.video.currentTime = 1.4; f.video.dispatchEvent(new Event('seeked'));
    assert.equal(updates, 1); assert.equal(f.native.size, 1);
    assert.equal(f.timers.size, 1, 'a paused seek has a bounded fallback for missing native delivery');
    const late = [...f.native.values()][0];
    f.fire(f.timers);
    assert.equal(updates, 2, 'the fallback refreshes the now-readable frame');
    assert.equal(f.native.size + f.frames.size + f.timers.size, 0, 'paused media does not start a polling loop');
    late(); assert.equal(updates, 2, 'a late native notification cannot repeat the retired update');
    assert.equal(f.video.paused, true); assert.equal(f.video.currentTime, 1.4);
  } finally { f.watcher.dispose(); }
});

test('native presentation and observation stops retire late paused fallback callbacks', () => {
  for (const stop of ['native', 'pause', 'waiting', 'ended', 'emptied', 'seeking', 'hidden', 'invisible', 'dispose']) {
    let updates = 0; const f = fixture(() => updates++);
    try {
      f.video.paused = true; f.video.dispatchEvent(new Event('pause'));
      f.video.currentTime = 1.4; f.video.dispatchEvent(new Event('seeked'));
      const lateTimer = [...f.timers.values()][0], lateNative = [...f.native.values()][0];
      if (stop === 'native') f.fire(f.native);
      else if (stop === 'hidden') { f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); }
      else if (stop === 'invisible') f.watcher.setVisible(false);
      else if (stop === 'dispose') f.watcher.dispose();
      else f.video.dispatchEvent(new Event(stop));
      const settled = updates;
      assert.equal(f.native.size + f.frames.size + f.timers.size, 0, stop);
      lateTimer(); lateNative(); assert.equal(updates, settled, stop);
      assert.equal(f.native.size + f.frames.size + f.timers.size, 0, stop);
    } finally { f.watcher.dispose(); }
  }
});

test('playback resuming before a paused fallback retains stalled-native recovery', () => {
  let updates = 0; const f = fixture(() => updates++);
  try {
    f.video.paused = true; f.video.dispatchEvent(new Event('pause'));
    f.video.currentTime = 1.4; f.video.dispatchEvent(new Event('seeked'));
    f.video.paused = false; f.video.dispatchEvent(new Event('play'));
    f.fire(f.timers);
    assert.equal(f.native.size, 1); assert.equal(f.frames.size, 1);
    f.video.currentTime = 1.5; f.fire(f.frames);
    assert.equal(updates, 3);
    f.fire(f.native);
    assert.equal(f.frames.size, 0); assert.equal(f.native.size, 1); assert.equal(f.timers.size, 1);
    assert.equal(f.video.paused, false); assert.equal(f.video.currentTime, 1.5);
  } finally { f.watcher.dispose(); }
});
