import assert from 'node:assert/strict';
import test from 'node:test';
import { Lyra3dIdPicker } from '../dist/core/picking.js';
import { createLyra3dViewport } from '../dist/core/viewport.js';
import { installFakeBrowser, pointerEvent } from './fake-browser.mjs';

test('a failed mount attempts every release step and still reports the original failure', (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const attempts = [];
  const refuse = (name) => () => { attempts.push(name); throw new Error(`${name} failed`); };
  t.mock.method(Lyra3dIdPicker.prototype, 'dispose', refuse('picker'));
  const original = new Error('host rejected the first report');
  const container = browser.container;
  assert.throws(() => createLyra3dViewport(container, {
    rendering() {
      const [, canvas] = browser.canvases;
      canvas.removeEventListener = refuse('listener');
      canvas.remove = refuse('canvas');
      canvas.contexts[0].state.fail.set('getExtension', new Error('extension failed'));
      throw original;
    },
  }), (error) => error === original);
  assert.deepEqual([...new Set(attempts)].sort(), ['canvas', 'listener', 'picker']);
  assert.ok(attempts.filter((name) => name === 'listener').length >= 10, 'every listener removal is attempted independently');
});

test('a renderer name that is not text counts as hardware', (t) => {
  const browser = installFakeBrowser({ renderer: 42 });
  t.after(() => browser.restore());
  const viewport = createLyra3dViewport(browser.container, {});
  t.after(() => viewport.dispose());
  assert.equal(viewport.software, false);
});

test('a pointer that can no longer be released does not stop the viewport from letting go of a gesture', (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const viewport = createLyra3dViewport(browser.container, {}, { pick: () => null });
  t.after(() => viewport.dispose());
  const { canvas } = viewport;
  canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 0 }));
  assert.ok(canvas.captured.has(1));
  canvas.captureFails = true;
  assert.doesNotThrow(() => viewport.dispose());
  assert.equal(viewport.disposed, true);
  assert.deepEqual(browser.container.children, []);
});

test('a platform fault while stopping a half-built viewport does not hide the original failure', (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const original = new Error('host rejected the first report');
  assert.throws(() => createLyra3dViewport(browser.container, {
    rendering() {
      // Input arriving before the viewport is returned schedules a frame that cleanup must cancel.
      browser.canvases[1].dispatchEvent(pointerEvent('pointermove', { clientX: 1 }));
      assert.equal(browser.pendingFrames(), 1);
      globalThis.cancelAnimationFrame = () => { throw new Error('cancelAnimationFrame failed'); };
      throw original;
    },
  }), (error) => error === original);
  assert.deepEqual(browser.container.children, []);
});
