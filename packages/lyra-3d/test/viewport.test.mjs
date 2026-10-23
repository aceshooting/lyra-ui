import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ORBIT_CAMERA, LYRA_3D_FIELD_OF_VIEW } from '../dist/core/orbit.js';
import { encodePickId } from '../dist/core/picking.js';
import { Lyra3dUnsupportedError, createLyra3dViewport, probeSoftwareRendering } from '../dist/core/viewport.js';
import { FakeCanvas, createFakeGl, installFakeBrowser, pointerEvent, wheelEvent } from './fake-browser.mjs';

/** A viewport on the fake browser, with every host callback recorded. */
function setup(t, options = {}, hostOverrides = {}, browserOptions = {}) {
  const browser = installFakeBrowser(browserOptions);
  const calls = { hover: [], pick: [], camera: [], lost: [], rendering: [], restored: 0 };
  const host = {
    hover: (item) => calls.hover.push(item),
    pick: (item, modifiers) => calls.pick.push({ item, ...modifiers }),
    camera: (camera) => calls.camera.push(camera),
    lost: (reason, detail) => calls.lost.push({ reason, detail }),
    rendering: (info) => calls.rendering.push(info),
    restored: () => { calls.restored += 1; },
    ...hostOverrides,
  };
  let viewport;
  t.after(() => {
    try { viewport?.dispose(); } finally { browser.restore(); }
  });
  viewport = createLyra3dViewport(browser.container, host, options);
  return { browser, calls, host, viewport, canvas: viewport.canvas, gl: browser.gl };
}

const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);

test('creates a mirrored scene in the container, requests one WebGL2 context and reports hardware rendering', (t) => {
  const { browser, calls, viewport, canvas } = setup(t);
  assert.deepEqual(browser.container.children, [canvas]);
  assert.deepEqual([canvas.style.display, canvas.style.inlineSize, canvas.style.blockSize, canvas.style.touchAction], ['block', '100%', '100%', 'none']);
  assert.equal(viewport.world.scale.y, -1);
  assert.equal(viewport.pickWorld.scale.y, -1);
  assert.equal(viewport.world.parent, viewport.scene);
  assert.equal(viewport.pickWorld.parent, viewport.pickScene);
  near(viewport.camera.fov, (LYRA_3D_FIELD_OF_VIEW * 180) / Math.PI);
  assert.deepEqual([viewport.width, viewport.height, viewport.lost, viewport.disposed], [1, 1, false, false]);
  assert.equal(viewport.orbit, DEFAULT_ORBIT_CAMERA);
  assert.equal(viewport.software, false);
  assert.deepEqual(calls.rendering, [{ software: false }]);
  // The probe context is released at once; the owned context keeps the requested attributes.
  const [probe, owned] = browser.canvases;
  assert.deepEqual(probe.requests, [{ kind: 'webgl2', attributes: { failIfMajorPerformanceCaveat: true } }]);
  assert.equal(probe.contexts[0].state.loseContextCalls, 1);
  assert.deepEqual(owned.requests[0].attributes, {
    alpha: true, depth: true, stencil: false, antialias: true, premultipliedAlpha: true,
    preserveDrawingBuffer: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false,
  });
});

test('a major performance caveat means software rendering and defaults antialiasing off', (t) => {
  const { calls, viewport, browser } = setup(t, {}, {}, { caveat: true });
  assert.equal(viewport.software, true);
  assert.deepEqual(calls.rendering, [{ software: true }]);
  assert.equal(browser.canvases[1].requests[0].attributes.antialias, false);
});

test('an explicit antialias option wins over the caveat default', (t) => {
  const { browser } = setup(t, { antialias: true }, {}, { caveat: true });
  assert.equal(browser.canvases[1].requests[0].attributes.antialias, true);
});

test('software rasterizers are recognised by their renderer string, masked or unmasked', (t) => {
  assert.equal(setup(t, {}, {}, { renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))' }).viewport.software, true);
  // Browsers that hide the GPU report a generic name; the debug extension still names it.
  assert.equal(setup(t, {}, {}, { renderer: 'WebKit WebGL', unmasked: 'llvmpipe (LLVM 17.0.6, 256 bits)' }).viewport.software, true);
  assert.equal(setup(t, {}, {}, { renderer: 'WebKit WebGL', unmasked: 'NVIDIA GeForce RTX' }).viewport.software, false);
  assert.equal(setup(t, {}, {}, { renderer: 'WebKit WebGL' }).viewport.software, false);
  assert.equal(setup(t, {}, {}, { renderer: 'Apple GPU' }).viewport.software, false);
});

test('probeSoftwareRendering releases its context and reports a refused request', () => {
  const granted = new FakeCanvas({});
  assert.equal(probeSoftwareRendering(() => granted), false);
  assert.equal(granted.contexts[0].state.loseContextCalls, 1);
  const refused = new FakeCanvas({ caveat: true });
  assert.equal(probeSoftwareRendering(() => refused), true);
  assert.equal(refused.contexts.length, 0);
  const already = new FakeCanvas({});
  already.contextFactory = (canvas) => { const context = createFakeGl(canvas, {}); context.state.lose(); return context; };
  assert.equal(probeSoftwareRendering(() => already), false);
  assert.equal(already.contexts[0].state.loseContextCalls, undefined, 'a lost context needs no release');
});

test('without WebGL2 the viewport refuses to mount with the documented error and leaves nothing behind', (t) => {
  const browser = installFakeBrowser({ noContext: true });
  t.after(() => browser.restore());
  const calls = [];
  assert.throws(
    () => createLyra3dViewport(browser.container, { rendering: () => calls.push('rendering') }),
    (error) => error instanceof Lyra3dUnsupportedError && error.code === 'webgl-unavailable'
      && error.name === 'Lyra3dUnsupportedError' && error.message === 'WebGL2 is not available.',
  );
  assert.deepEqual(browser.container.children, []);
  assert.deepEqual(calls, []);
  assert.equal(new Lyra3dUnsupportedError('custom').message, 'custom');
});

test('a context the renderer cannot use is released and reported as unsupported', (t) => {
  const browser = installFakeBrowser({});
  t.after(() => browser.restore());
  const released = [];
  const createElement = document.createElement;
  document.createElement = (tag) => {
    const canvas = createElement(tag);
    canvas.contextFactory = (self) => ({
      canvas: self,
      isContextLost: () => false,
      getExtension: (name) => (name === 'WEBGL_lose_context' ? { loseContext: () => released.push(name) } : null),
    });
    return canvas;
  };
  assert.throws(() => createLyra3dViewport(browser.container, {}), Lyra3dUnsupportedError);
  assert.deepEqual(browser.container.children, []);
  assert.ok(released.length >= 1, 'the unusable context is released');
});

test('a context that is not WebGL2 is released and reported as unsupported', (t) => {
  const browser = installFakeBrowser({});
  t.after(() => browser.restore());
  const canvasFactory = document.createElement;
  document.createElement = (tag) => {
    const canvas = canvasFactory(tag);
    canvas.contextFactory = (self) => {
      const context = createFakeGl(self, {});
      Object.setPrototypeOf(context, Object.prototype);
      return context;
    };
    return canvas;
  };
  assert.throws(() => createLyra3dViewport(browser.container, {}), Lyra3dUnsupportedError);
  assert.deepEqual(browser.container.children, []);
  assert.equal(browser.gl.lost, true, 'the context is lost on release');
});

test('a host callback that throws while mounting leaves nothing attached and stays observable', (t) => {
  const browser = installFakeBrowser({});
  t.after(() => browser.restore());
  const failure = new Error('host rejected the first report');
  assert.throws(() => createLyra3dViewport(browser.container, { rendering() { throw failure; } }), (error) => error === failure);
  const [, canvas] = browser.canvases;
  assert.deepEqual(browser.container.children, []);
  assert.equal(canvas.contexts[0].state.lost, true, 'the context is released');
  // Listeners are gone: input on the abandoned canvas reaches nothing.
  assert.doesNotThrow(() => canvas.dispatchEvent(pointerEvent('pointerdown')));
  assert.equal(browser.pendingFrames(), 0);
});

test('resize rounds, clamps to one pixel and ignores non-finite sizes; the pixel ratio scales the backing store', (t) => {
  const { viewport, canvas } = setup(t);
  viewport.resize(640.4, 479.6);
  assert.deepEqual([viewport.width, viewport.height, canvas.width, canvas.height], [640, 480, 640, 480]);
  viewport.resize(Number.NaN, Number.POSITIVE_INFINITY);
  assert.deepEqual([viewport.width, viewport.height], [640, 480]);
  viewport.resize(0.2, -5);
  assert.deepEqual([viewport.width, viewport.height], [1, 1]);
  viewport.resize(200, 100);
  const resolved = viewport.setStyle({ devicePixelRatio: 2, background: 'rgba(0, 0, 0, 0.5)' });
  assert.equal(resolved.devicePixelRatio, 2);
  assert.equal(viewport.style, resolved);
  assert.deepEqual([canvas.width, canvas.height], [400, 200]);
});

test('the clear color follows the style background, including its alpha', (t) => {
  const { viewport, gl } = setup(t);
  viewport.resize(100, 100);
  viewport.setStyle({ background: 'rgba(255, 0, 0, 0.5)' });
  viewport.renderNow();
  const clears = gl.callsOf('clearColor');
  assert.equal(clears.at(-1)[4], 0.5);
});

test('invalidate schedules a single frame and renderNow replaces it with an immediate render', (t) => {
  const { browser, viewport, gl } = setup(t);
  viewport.invalidate();
  viewport.invalidate();
  assert.equal(browser.pendingFrames(), 1);
  const draws = gl.callsOf('clear').length;
  viewport.renderNow();
  assert.equal(browser.pendingFrames(), 0, 'the pending frame is cancelled');
  assert.ok(gl.callsOf('clear').length > draws, 'the scene was rendered synchronously');
  viewport.invalidate();
  assert.equal(browser.flushFrames(), 1);
  // One idle frame stays armed so a camera write from a host animation frame draws in that frame.
  assert.equal(browser.pendingFrames(), 1, 'one idle frame follows a render');
  const rendered = gl.callsOf('clear').length;
  viewport.invalidate();
  assert.equal(browser.pendingFrames(), 1, 'a request inside the idle window reuses its frame');
  browser.flushFrames();
  assert.ok(gl.callsOf('clear').length > rendered, 'and is drawn by it');
  const settled = gl.callsOf('clear').length;
  assert.equal(browser.flushFrames(), 1, 'the idle frame runs');
  assert.equal(gl.callsOf('clear').length, settled, 'without drawing');
  assert.equal(browser.pendingFrames(), 0, 'a quiet viewport then schedules nothing further');
});

test('frame callbacks run before every render until unsubscribed', (t) => {
  const { browser, viewport } = setup(t);
  const seen = [];
  const stop = viewport.onFrame((time) => seen.push(time));
  viewport.invalidate();
  browser.flushFrames(1000);
  viewport.invalidate();
  browser.flushFrames(2000);
  stop();
  viewport.invalidate();
  browser.flushFrames(3000);
  assert.deepEqual(seen, [1000, 2000]);
});

test('a frame callback that disposes the viewport stops the render and later callbacks', (t) => {
  const { browser, viewport, canvas } = setup(t);
  const order = [];
  viewport.onFrame(() => { order.push('first'); viewport.dispose(); });
  viewport.onFrame(() => order.push('second'));
  viewport.invalidate();
  browser.flushFrames();
  assert.deepEqual(order, ['first']);
  assert.equal(viewport.disposed, true);
  assert.equal(canvas.parent, undefined);
});

test('project maps the orbit target to the middle of the view and nothing behind the near plane', (t) => {
  const { viewport } = setup(t);
  viewport.resize(400, 300);
  const middle = viewport.project(viewport.orbit.target);
  near(middle.x, 200);
  near(middle.y, 150);
  assert.equal(viewport.project({ x: 0, y: 0, z: 10_000 }), null);
});

test('setOrbit moves the camera silently and cancels a running transition', (t) => {
  const { browser, calls, viewport } = setup(t);
  viewport.resize(400, 300);
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 2 });
  viewport.setOrbit({ ...DEFAULT_ORBIT_CAMERA, yaw: 0.5, pitch: 0.25 });
  assert.equal(viewport.orbit.yaw, 0.5);
  browser.flushFrames(performance.now() + 1000);
  browser.flushFrames(performance.now() + 1100);
  assert.deepEqual(calls.camera, []);
  assert.equal(viewport.orbit.yaw, 0.5);
  assert.equal(browser.pendingFrames(), 0);
});

test('transitionTo animates toward the target, tells the host once per frame and ends exactly on target', (t) => {
  const { browser, calls, viewport } = setup(t);
  viewport.resize(400, 300);
  const started = performance.now();
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 1, distance: 800 });
  assert.equal(viewport.orbit.yaw, 0, 'nothing jumps before the first frame');
  browser.flushFrames(started + 200);
  assert.equal(calls.camera.length, 1);
  assert.ok(viewport.orbit.yaw > 0 && viewport.orbit.yaw < 1, `yaw ${viewport.orbit.yaw} is partway`);
  assert.ok(viewport.orbit.distance > 500 && viewport.orbit.distance < 800);
  assert.equal(browser.pendingFrames(), 1, 'the transition keeps requesting frames');
  browser.flushFrames(started + 5000);
  assert.deepEqual(calls.camera.at(-1), { yaw: 1, pitch: 0, distance: 800, target: { x: 0, y: 0, z: 0 } });
  assert.equal(calls.camera.length, 2);
  assert.equal(browser.pendingFrames(), 1, 'one idle frame follows the last render');
  browser.flushFrames(started + 5100);
  assert.equal(calls.camera.length, 2);
  assert.equal(browser.pendingFrames(), 0);
});

test('reduced motion jumps straight to the target and an active transition completes when it is requested', (t) => {
  const { browser, calls, viewport } = setup(t);
  viewport.resize(400, 300);
  viewport.setStyle({ reducedMotion: true });
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 });
  assert.equal(viewport.orbit.yaw, 1);
  browser.flushFrames();
  browser.flushFrames();
  assert.equal(calls.camera.length, 1);
  assert.equal(browser.pendingFrames(), 0);
  viewport.setStyle({ reducedMotion: false });
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 2 });
  viewport.setStyle({ reducedMotion: true });
  assert.equal(viewport.orbit.yaw, 2, 'enabling reduced motion mid-flight finishes the move');
  browser.flushFrames();
  assert.equal(calls.camera.at(-1).yaw, 2);
});

test('camera limits apply to transitions and to gestures; an unusable limit keeps the requested camera', (t) => {
  const { browser, calls, viewport } = setup(t, {
    wheelZoom: () => true,
    constrain: (camera) => ({ ...camera, distance: Math.min(camera.distance, 800) }),
  });
  viewport.resize(400, 300);
  viewport.setStyle({ reducedMotion: true });
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, distance: 5000 });
  assert.equal(viewport.orbit.distance, 800);
  viewport.canvas.dispatchEvent(wheelEvent(300));
  browser.flushFrames();
  assert.equal(calls.camera.at(-1).distance, 800, 'zooming out stays within the limit');
  assert.ok(viewport.orbit.distance <= 800);
});

test('a constrain callback returning rubbish falls back to the unconstrained request', (t) => {
  const { browser, calls, viewport } = setup(t, { wheelZoom: () => true, constrain: () => null });
  viewport.canvas.dispatchEvent(wheelEvent(100));
  browser.flushFrames();
  near(calls.camera.at(-1).distance, 500 * Math.exp(0.2), 1e-6);
});

test('dragging orbits after the slop, at most one camera report per frame, and releases the pointer', (t) => {
  const { browser, calls, canvas, viewport } = setup(t, { pick: () => null });
  viewport.resize(400, 300);
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
  assert.ok(canvas.captured.has(1), 'the canvas captures the pointer for the drag');
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 14, clientY: 10 }));
  browser.flushFrames();
  assert.deepEqual(calls.camera, [], 'a movement inside the slop is not a drag yet');
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 30, clientY: 10 }));
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 50, clientY: 10 }));
  browser.flushFrames();
  assert.equal(calls.camera.length, 1);
  near(calls.camera[0].yaw, (50 - 14) * 0.008);
  assert.equal(calls.camera[0].pitch, 0);
  canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10 }));
  assert.equal(canvas.captured.size, 0);
  assert.deepEqual(calls.pick, [], 'finishing a drag is not a click');
});

test('vertical drags change the pitch and wheel-less pages keep scrolling', (t) => {
  const { browser, calls, canvas } = setup(t, { pick: () => null });
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 0, clientY: 100 }));
  browser.flushFrames();
  near(calls.camera.at(-1).pitch, -100 * 0.008);
  const wheel = wheelEvent(100);
  canvas.dispatchEvent(wheel);
  assert.equal(wheel.defaultPrevented, false, 'without wheelZoom the page keeps the wheel');
});

test('shift, the secondary and the middle button pan; the primary button pans when the callback says so', (t) => {
  const presses = [];
  let panning = false;
  const { browser, calls, canvas, viewport } = setup(t, { pick: () => null, primaryPan: () => { presses.push('press'); return panning; } });
  viewport.resize(400, 300);
  const drag = (fields, id) => {
    canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: id, ...fields }));
    canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 160, clientY: 100, pointerId: id }));
    browser.flushFrames();
    canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 160, clientY: 100, pointerId: id }));
    return calls.camera.at(-1);
  };
  const orbited = drag({}, 1);
  assert.ok(orbited.yaw > 0 && orbited.target.x === 0, 'a plain primary drag orbits');
  for (const [fields, name] of [[{ shiftKey: true }, 'shift'], [{ button: 2 }, 'secondary'], [{ button: 1 }, 'middle']]) {
    const before = calls.camera.length;
    const moved = drag(fields, 2);
    assert.equal(calls.camera.length, before + 1, name);
    assert.notEqual(moved.target.x, 0, `${name} drag moves the target`);
    assert.equal(moved.yaw, orbited.yaw, `${name} drag keeps the orientation`);
    viewport.setOrbit(orbited);
  }
  assert.equal(presses.length, 1, 'the primary callback is consulted for plain primary presses only');
  panning = true;
  const primaryPan = drag({}, 3);
  assert.notEqual(primaryPan.target.x, 0);
  assert.equal(presses.length, 2, 'the callback is evaluated at each primary press');
});

test('unsupported buttons and extra pointers do not start or disturb a gesture', (t) => {
  const { browser, calls, canvas } = setup(t, { pick: () => null });
  canvas.dispatchEvent(pointerEvent('pointerdown', { button: 3 }));
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 100 }));
  browser.flushFrames();
  assert.deepEqual(calls.camera, []);
  canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 0 }));
  canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 8, clientX: 0 }));
  assert.deepEqual([...canvas.captured], [7], 'a second pointer cannot take over the gesture');
  canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 8, clientX: 100 }));
  browser.flushFrames();
  assert.deepEqual(calls.camera, [], 'moves of the other pointer are ignored');
  canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 8 }));
  assert.ok(canvas.captured.has(7), 'the other pointer cannot end the gesture');
});

test('the secondary button suppresses exactly one context menu after its drag', (t) => {
  const { canvas } = setup(t, { pick: () => null });
  canvas.dispatchEvent(pointerEvent('pointerdown', { button: 2 }));
  const first = new Event('contextmenu', { cancelable: true });
  canvas.dispatchEvent(first);
  assert.equal(first.defaultPrevented, true);
  const second = new Event('contextmenu', { cancelable: true });
  canvas.dispatchEvent(second);
  assert.equal(second.defaultPrevented, false, 'the next menu is the browser\'s own');
  const plain = new Event('contextmenu', { cancelable: true });
  canvas.dispatchEvent(plain);
  assert.equal(plain.defaultPrevented, false);
});

test('gestures survive pointers that cannot be captured', (t) => {
  const { browser, calls, canvas } = setup(t, { pick: () => 3 });
  canvas.captureFails = true;
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 40 }));
  browser.flushFrames();
  assert.equal(calls.camera.length, 1);
  assert.doesNotThrow(() => canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 40 })));
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 5 }));
  canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 5 }));
  assert.deepEqual(calls.pick.map((entry) => entry.item), [3]);
});

test('a click activates the item under the pointer, in canvas coordinates, with its modifiers', (t) => {
  const picked = [];
  const { calls, canvas } = setup(t, { pick: (x, y) => { picked.push([x, y]); return 4; } });
  canvas.left = 100;
  canvas.top = 50;
  const click = (fields) => {
    canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 110, clientY: 70, ...fields }));
    canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 110, clientY: 70, ...fields }));
  };
  click({});
  click({ shiftKey: true });
  click({ ctrlKey: true });
  click({ metaKey: true });
  assert.deepEqual(picked, [[10, 20], [10, 20], [10, 20], [10, 20]]);
  assert.deepEqual(calls.pick, [
    { item: 4, shift: false, ctrl: false, double: false },
    { item: 4, shift: true, ctrl: false, double: false },
    { item: 4, shift: false, ctrl: true, double: false },
    { item: 4, shift: false, ctrl: true, double: false },
  ]);
});

test('cancelled gestures and secondary-button releases do not activate anything', (t) => {
  const { calls, canvas } = setup(t, { pick: () => 1 });
  canvas.dispatchEvent(pointerEvent('pointerdown'));
  canvas.dispatchEvent(pointerEvent('pointercancel'));
  canvas.dispatchEvent(pointerEvent('pointerdown'));
  canvas.dispatchEvent(pointerEvent('lostpointercapture'));
  canvas.dispatchEvent(pointerEvent('pointerdown', { button: 2 }));
  canvas.dispatchEvent(pointerEvent('pointerup', { button: 2 }));
  canvas.dispatchEvent(pointerEvent('pointerup'));
  assert.deepEqual(calls.pick, []);
});

test('double click activates with the double flag and needs a picker', (t) => {
  const { calls, canvas } = setup(t, { pick: () => 2 });
  canvas.dispatchEvent(Object.assign(new Event('dblclick'), { clientX: 3, clientY: 4, shiftKey: true, ctrlKey: false, metaKey: false }));
  assert.deepEqual(calls.pick, [{ item: 2, shift: true, ctrl: false, double: true }]);
  const disabled = setup(t, { pick: null });
  disabled.canvas.dispatchEvent(Object.assign(new Event('dblclick'), { clientX: 3, clientY: 4 }));
  disabled.canvas.dispatchEvent(pointerEvent('pointerdown'));
  disabled.canvas.dispatchEvent(pointerEvent('pointerup'));
  disabled.canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 4 }));
  disabled.browser.flushFrames();
  assert.deepEqual(disabled.calls.pick, []);
  assert.deepEqual(disabled.calls.hover, []);
});

test('hover reports only changes of the item under a resting pointer and clears when the pointer leaves', (t) => {
  let under = null;
  const { browser, calls, canvas } = setup(t, { pick: () => under });
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 5, clientY: 5 }));
  browser.flushFrames();
  assert.deepEqual(calls.hover, [], 'the background was already the hovered state');
  under = 3;
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 6, clientY: 5 }));
  browser.flushFrames();
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 7, clientY: 5 }));
  browser.flushFrames();
  assert.deepEqual(calls.hover, [3], 'the same item is reported once');
  under = 5;
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 8, clientY: 5 }));
  browser.flushFrames();
  assert.deepEqual(calls.hover, [3, 5]);
  canvas.dispatchEvent(new Event('pointerleave'));
  assert.deepEqual(calls.hover, [3, 5, null]);
  canvas.dispatchEvent(new Event('pointerleave'));
  assert.deepEqual(calls.hover, [3, 5, null], 'leaving twice reports once');
});

test('hover is not evaluated while a button is held', (t) => {
  let asked = 0;
  const { browser, canvas } = setup(t, { pick: () => { asked += 1; return null; } });
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 1 }));
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 1 }));
  browser.flushFrames();
  assert.equal(asked, 0);
});

test('the wheel zooms only when the page opts in, clamps the step and ignores non-finite deltas', (t) => {
  const { browser, calls, canvas } = setup(t, { wheelZoom: (event) => event.ctrlKey === true });
  const plain = wheelEvent(100);
  canvas.dispatchEvent(plain);
  assert.equal(plain.defaultPrevented, false);
  browser.flushFrames();
  assert.deepEqual(calls.camera, []);
  const zoom = wheelEvent(100, { ctrlKey: true });
  canvas.dispatchEvent(zoom);
  assert.equal(zoom.defaultPrevented, true);
  browser.flushFrames();
  near(calls.camera.at(-1).distance, 500 * Math.exp(0.2), 1e-6);
  canvas.dispatchEvent(wheelEvent(100_000, { ctrlKey: true }));
  browser.flushFrames();
  near(calls.camera.at(-1).distance, 500 * Math.exp(0.2) * Math.exp(0.6), 1e-6);
  canvas.dispatchEvent(wheelEvent(Number.NaN, { ctrlKey: true }));
  browser.flushFrames();
  near(calls.camera.at(-1).distance, 500 * Math.exp(0.8), 1e-6);
});

test('a user gesture replaces a running transition', (t) => {
  const { browser, calls, canvas, viewport } = setup(t, { pick: () => null });
  const started = performance.now();
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 2 });
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 50 }));
  browser.flushFrames(started + 10_000);
  browser.flushFrames(started + 10_100);
  assert.ok(Math.abs(calls.camera.at(-1).yaw - 50 * 0.008) < 1e-9, 'only the gesture moved the camera');
  assert.equal(browser.pendingFrames(), 0);
});

test('the default picker reads the id colour the GPU produced under the pointer', (t) => {
  const { calls, canvas, viewport, gl } = setup(t);
  viewport.resize(200, 100);
  const [red, green, blue] = encodePickId(4);
  gl.pixel = [red, green, blue, 255];
  assert.equal(viewport.pickAt(10, 10), 4);
  assert.notEqual(viewport.camera.view?.enabled, true, 'the pick view offset is cleared');
  gl.pixel = [0, 0, 0, 0];
  assert.equal(viewport.pickAt(10, 10), null, 'the background has no item');
  assert.equal(viewport.pickAt(-1, 10), null);
  assert.equal(viewport.pickAt(200, 10), null);
  assert.equal(viewport.pickAt(10, Number.NaN), null);
  gl.pixel = [...encodePickId(9), 255];
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 20, clientY: 20 }));
  canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 20, clientY: 20 }));
  assert.deepEqual(calls.pick.map((entry) => entry.item), [9]);
});

test('context loss stops interaction, is reported once and a restored context re-applies the renderer state', (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const restored = [];
  const { browser, calls, canvas, viewport, gl } = setup(t, { pick: () => 6, onRestore: () => restored.push(calls.restored) });
  viewport.resize(400, 300);
  viewport.setStyle({ devicePixelRatio: 2 });
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 9, clientY: 9 }));
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(calls.restored, 0, 'a restore without a loss is ignored');
  gl.lose();
  canvas.dispatchEvent(new Event('webglcontextlost'));
  canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.deepEqual(calls.lost, [{ reason: 'context-lost', detail: undefined }]);
  assert.equal(viewport.lost, true);
  assert.equal(browser.pendingFrames(), 0);
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 90 }));
  canvas.dispatchEvent(wheelEvent(100));
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 });
  viewport.resize(10, 10);
  browser.flushFrames();
  assert.deepEqual(calls.camera, []);
  assert.equal(viewport.pickAt(5, 5), null, 'a lost context cannot be read');
  // The browser brings the context back; sizes and colours are applied again before the first frame.
  gl.lost = false;
  canvas.width = 0;
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(viewport.lost, false);
  assert.deepEqual([canvas.width, canvas.height], [20, 20], 'the size set while lost is applied on restore');
  assert.deepEqual(restored, [0], 'the component hook runs before the host hears about it');
  assert.equal(calls.restored, 1);
  assert.equal(browser.pendingFrames(), 1);
  browser.flushFrames();
  assert.deepEqual(calls.hover, [6], 'the resting pointer is picked again against the restored scene');
});

test('a failure while restoring state ends the viewport with a generic report', (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const { calls, canvas, viewport, gl } = setup(t);
  gl.lose();
  canvas.dispatchEvent(new Event('webglcontextlost'));
  gl.lost = false;
  viewport.renderer.setSize = () => { throw new Error('driver detail'); };
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.deepEqual(calls.lost, [{ reason: 'context-lost', detail: undefined }, { reason: 'error', detail: 'Rendering failed.' }]);
  assert.equal(calls.restored, 0);
  assert.equal(viewport.lost, true);
});

test('a renderer failure is reported once with a generic message and is terminal', (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const { browser, calls, canvas, viewport } = setup(t, { pick: () => 1 });
  const secrets = [];
  viewport.onFrame(() => viewport.invalidate());
  viewport.renderer.render = () => { secrets.push('boom'); throw new Error('Untrusted driver detail'); };
  viewport.renderNow();
  viewport.renderNow();
  assert.deepEqual(calls.lost, [{ reason: 'error', detail: 'Rendering failed.' }]);
  assert.equal(viewport.lost, true);
  assert.equal(secrets.length, 1, 'rendering stops after the first failure');
  assert.equal(browser.pendingFrames(), 0);
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 80 }));
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 });
  viewport.setStyle({ background: '#fff' });
  viewport.resize(50, 50);
  browser.flushFrames();
  assert.deepEqual(calls.camera, []);
  assert.equal(calls.lost.length, 1);
  // A context that comes back later does not resurrect a failed renderer.
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(calls.restored, 0);
});

test('a picking failure ends the viewport like any other renderer failure', (t) => {
  const { calls, viewport, gl } = setup(t);
  viewport.resize(100, 100);
  gl.fail.set('readPixels', new Error('driver detail'));
  assert.equal(viewport.pickAt(5, 5), null);
  assert.deepEqual(calls.lost, [{ reason: 'error', detail: 'Rendering failed.' }]);
  assert.notEqual(viewport.camera.view?.enabled, true, 'the pick view offset is cleared even when reading fails');
});

test('style and size changes that fail to reach the renderer are reported, not thrown', (t) => {
  const { calls, viewport } = setup(t);
  viewport.renderer.setClearColor = () => { throw new Error('driver detail'); };
  assert.doesNotThrow(() => viewport.setStyle({ background: '#123456' }));
  assert.deepEqual(calls.lost, [{ reason: 'error', detail: 'Rendering failed.' }]);
  assert.doesNotThrow(() => viewport.resize(10, 10));
  assert.equal(calls.lost.length, 1);
});

test('dispose detaches everything, releases the context once and is safe to repeat', (t) => {
  const { browser, calls, canvas, viewport, gl } = setup(t, { pick: () => 1 });
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
  assert.ok(canvas.captured.has(1));
  viewport.invalidate();
  const context = canvas.contexts[0];
  assert.equal(Object.hasOwn(context, 'createBuffer'), true, 'the epoch guard is installed while mounted');
  viewport.dispose();
  viewport.dispose();
  assert.equal(viewport.disposed, true);
  assert.deepEqual(browser.container.children, []);
  assert.equal(canvas.captured.size, 0, 'a captured pointer is released');
  assert.equal(browser.pendingFrames(), 0);
  assert.equal(gl.loseContextCalls, 1);
  assert.equal(Object.hasOwn(context, 'createBuffer'), false, 'the epoch guard is removed');
  canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 90 }));
  canvas.dispatchEvent(new Event('webglcontextlost'));
  canvas.dispatchEvent(wheelEvent(100));
  viewport.invalidate();
  viewport.transitionTo({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 });
  viewport.setStyle({});
  viewport.resize(5, 5);
  assert.equal(viewport.pickAt(1, 1), null);
  assert.deepEqual(calls, { hover: [], pick: [], camera: [], lost: [], rendering: [{ software: false }], restored: 0 });
});

test('dispose attempts every cleanup step and reports the first failure', (t) => {
  const { browser, canvas, viewport, gl } = setup(t);
  viewport.renderer.dispose = () => { throw new Error('renderer failed'); };
  canvas.remove = () => { throw new Error('remove failed'); };
  assert.throws(() => viewport.dispose(), /renderer failed/);
  assert.equal(gl.loseContextCalls, 1, 'the context was still released');
  assert.equal(viewport.disposed, true);
  assert.equal(browser.pendingFrames(), 0);
});
