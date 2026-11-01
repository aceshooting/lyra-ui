import assert from 'node:assert/strict';
import { BufferGeometry, Material, Texture } from 'three';
import { DEFAULT_LYRA_3D_STYLE } from '../dist/core/style.js';
import { createFixture, settle, until } from './points-xr-fixture.mjs';
import { deferred } from './xr-controller-fixture.mjs';

export { settle, until };
export const labelStyle = { ...DEFAULT_LYRA_3D_STYLE, fontFamily: 'Fixture Sans' };
export const labelData = () => ({
  positions: new Float32Array([-1, 0, 0, 1, .5, .25]), labels: ['left', 'right'], mode: '3d',
  axes: [{ axis: 'x', min: -1, max: 1, label: 'axis', ticks: [{ value: 0, label: 'origin' }] }],
});
export function labelMeshes(viewport) {
  const result = [];
  viewport.scene.traverse(object => { if (object.geometry?.getAttribute('labelRect')) result.push(object); });
  return result;
}
export const inlineLabelMesh = viewport => viewport.scene.children.find(object => object.material?.uniforms?.labels);
export const callbackCount = (record, name) => record.callbacks.filter(call => call[0] === name).length;

export function fontFace(overrides = {}) {
  return { family: 'Fixture Sans', style: 'normal', weight: 'normal', stretch: 'normal', unicodeRange: 'U+0-10FFFF',
    featureSettings: 'normal', ascentOverride: 'normal', descentOverride: 'normal', lineGapOverride: 'normal', status: 'loaded', ...overrides };
}

function createFonts() {
  const faces = new Set([fontFace()]);
  class Fonts extends EventTarget {
    calls = []; checks = []; iterations = 0; readyReads = 0; inFlight = 0; maxInFlight = 0;
    automatic = true; checkResult = true;
    get size() { return faces.size; }
    get status() { return [...faces].some(face => face.status === 'loading') ? 'loading' : 'loaded'; }
    get ready() { this.readyReads++; return Promise.resolve(this); }
    [Symbol.iterator]() { assert.equal(this, fonts); this.iterations++; return faces.values(); }
    values() { return this[Symbol.iterator](); }
    entries() { assert.equal(this, fonts); this.iterations++; return faces.entries(); }
    forEach(callback, receiver) { assert.equal(this, fonts); faces.forEach(face => callback.call(receiver, face, face, this)); }
    add(face) { faces.add(face); return this; }
    delete(face) { return faces.delete(face); }
    clear() { faces.clear(); }
    has(face) { return faces.has(face); }
    load(font, text) {
      assert.equal(this, fonts, 'Font operations retain their owner-document receiver');
      assert.equal(typeof font, 'string'); assert.equal(typeof text, 'string');
      const completion = deferred();
      const call = { font, text, pending: true, resolve: completion.resolve, reject: completion.reject };
      this.calls.push(call); this.inFlight++; this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
      const result = completion.promise.finally(() => { call.pending = false; this.inFlight--; });
      if (this.automatic) completion.resolve([]);
      return result;
    }
    check(font, text) {
      assert.equal(this, fonts, 'Font checks retain their owner-document receiver');
      this.checks.push({ font, text });
      return this.checkResult && [...faces].every(face => face.status === 'loaded');
    }
    resolveAll() { for (const call of this.calls) if (call.pending) call.resolve([]); }
    rejectAll(error = new Error('Controlled font load failure')) { for (const call of this.calls) if (call.pending) call.reject(error); }
    get pending() { return this.calls.filter(call => call.pending); }
    get firstFace() { return faces.values().next().value; }
  }
  const fonts = new Fonts();
  return fonts;
}

function canvasContext(canvas, text) {
  const commands = [], saved = [];
  const defaults = () => ({ font: '10px sans-serif', direction: 'inherit', textAlign: 'start', textBaseline: 'alphabetic',
    fillStyle: '#000000', globalAlpha: 1, globalCompositeOperation: 'source-over' });
  let state = defaults();
  const command = (name, ...args) => { const value = [name, ...args]; commands.push(value); text.commands.push(value); };
  const context = { canvas, calls: commands,
    measureText(value) {
      assert.equal(this, context); assert.equal(typeof value, 'string');
      const record = { canvas, text: value, ...state }; text.measures.push(record); command('measureText', value);
      text.onMeasure?.(record);
      if (text.metrics) return text.metrics(value, record);
      return value.trim().length === 0
        ? { width: value.length * 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: value.length * 2, actualBoundingBoxAscent: -2, actualBoundingBoxDescent: 2 }
        : { width: value.length * 2, actualBoundingBoxLeft: -1, actualBoundingBoxRight: value.length * 2 + 1, actualBoundingBoxAscent: 4, actualBoundingBoxDescent: 4 };
    },
    fillText(value, ...args) {
      assert.equal(this, context); assert.equal(typeof value, 'string');
      const record = { canvas, text: value, args, ...state }; text.draws.push(record); command('fillText', value, ...args);
      text.onDraw?.(record);
    },
    fillRect(...args) { assert.equal(this, context); command('fillRect', ...args); },
    clearRect(...args) { assert.equal(this, context); command('clearRect', ...args); },
    setTransform(...args) { assert.equal(this, context); command('setTransform', ...args); },
    resetTransform() { assert.equal(this, context); command('resetTransform'); },
    translate(...args) { assert.equal(this, context); command('translate', ...args); },
    scale(...args) { assert.equal(this, context); command('scale', ...args); },
    save() { assert.equal(this, context); saved.push({ ...state }); command('save'); },
    restore() { assert.equal(this, context); state = saved.pop() ?? state; command('restore'); },
    getImageData() { throw new Error('Atlas preparation must not read back Canvas pixels'); },
  };
  for (const key of Object.keys(state)) Object.defineProperty(context, key, { configurable: true,
    get: () => state[key], set(value) {
      command('set', key, value);
      if (key === 'font') {
        if (typeof value !== 'string' || !/^\d+(?:\.\d+)?px\s+\S/u.test(value) || text.rejectFont?.(value)) return;
        state.font = value.trim();
      } else state[key] = value;
    },
  });
  for (const dimension of ['width', 'height']) {
    let size = canvas[dimension];
    Object.defineProperty(canvas, dimension, { configurable: true, get: () => size, set(value) {
      size = value; command('canvas-size', dimension, value); state = defaults(); saved.length = 0;
    } });
  }
  text.canvases.push({ canvas, context, commands });
  return context;
}

/** Controlled font/Canvas primitives around the actual engine, renderer and native fixture. */
export async function createLabelFixture(t, options = {}) {
  const f = await createFixture(t, { ...options, data: options.data ?? labelData(), style: options.style ?? labelStyle });
  const ownerDocument = document, baseCleanup = f.cleanup.bind(f), baseCreateRecord = f.createRecord.bind(f);
  const originalCreate = ownerDocument.createElement;
  const originalFonts = Object.getOwnPropertyDescriptor(ownerDocument, 'fonts');
  const originalView = Object.getOwnPropertyDescriptor(ownerDocument, 'defaultView');
  const fonts = createFonts(), restores = [];
  const text = { commands: [], canvases: [], measures: [], draws: [], contextRequests: 0, directionReads: 0, fontReads: 0,
    noContext: false, metrics: undefined, rejectFont: undefined, onMeasure: undefined, onDraw: undefined };
  let cleaned = false, direction = options.direction ?? 'ltr';
  fonts.automatic = options.fonts !== 'pending';
  const view = {
    getComputedStyle(container) {
      assert.equal(container.ownerDocument, ownerDocument); text.directionReads++;
      return { direction, getPropertyValue: name => name === 'direction' ? direction : '' };
    },
  };
  Object.defineProperty(ownerDocument, 'defaultView', { configurable: true, value: view });
  Object.defineProperty(ownerDocument, 'fonts', { configurable: true, get() { text.fontReads++; return fonts; } });
  ownerDocument.createElement = function (name) {
    assert.equal(this, ownerDocument);
    const canvas = originalCreate.call(ownerDocument, name), getContext = canvas.getContext.bind(canvas);
    Object.defineProperty(canvas, 'ownerDocument', { configurable: true, value: ownerDocument });
    let context;
    canvas.getContext = function (kind, ...args) {
      assert.equal(this, canvas);
      if (kind === '2d') { text.contextRequests++; return text.noContext ? null : (context ??= canvasContext(canvas, text)); }
      const gl = getContext(kind, ...args);
      if (kind === 'webgl2' && gl) {
        const getParameter = gl.getParameter.bind(gl);
        Object.defineProperty(gl, 'getParameter', { configurable: true, value: name => name === gl.MAX_TEXTURE_SIZE ? (options.maxTextureSize ?? 4096) : getParameter(name) });
      }
      return gl;
    };
    return canvas;
  };
  const enhance = record => {
    Object.defineProperty(record.container, 'ownerDocument', { configurable: true, value: ownerDocument });
    for (const viewport of record.viewports) {
      Object.defineProperty(viewport.canvas, 'ownerDocument', { configurable: true, value: ownerDocument });
      viewport.renderer.capabilities.maxTextureSize = options.maxTextureSize ?? 4096;
    }
    return record;
  };
  enhance(f.record);
  f.createRecord = async (...args) => enhance(await baseCreateRecord(...args));
  Object.assign(f, { ownerDocument, fonts, text });
  Object.defineProperty(f, 'direction', { get: () => direction, set: value => { direction = value; } });
  f.observeDisposals = () => {
    const result = { geometry: new Map(), material: new Map(), texture: new Map() };
    for (const [prototype, name] of [[BufferGeometry.prototype, 'geometry'], [Material.prototype, 'material'], [Texture.prototype, 'texture']]) {
      const original = prototype.dispose;
      prototype.dispose = function (...args) { result[name].set(this, (result[name].get(this) ?? 0) + 1); return original.apply(this, args); };
      restores.push(() => { prototype.dispose = original; });
    }
    return result;
  };
  f.cleanup = async () => {
    if (cleaned) return; cleaned = true;
    try {
      const pending = baseCleanup();
      fonts.resolveAll(); await pending; await settle();
      assert.equal(fonts.pending.length, 0, 'Fixture cleanup settles every outstanding font operation');
    } finally {
      for (const restore of restores.reverse()) restore();
      ownerDocument.createElement = originalCreate;
      if (originalFonts) Object.defineProperty(ownerDocument, 'fonts', originalFonts); else delete ownerDocument.fonts;
      if (originalView) Object.defineProperty(ownerDocument, 'defaultView', originalView); else delete ownerDocument.defaultView;
    }
  };
  f.restore = f.cleanup;
  return f;
}

export async function startLabelPresentation(f, options) {
  const { prepared, ...preparationOptions } = options ?? {};
  const record = f.record, presentation = prepared ?? await record.engine.prepareXrPresentation(preparationOptions);
  const entry = record.enter(presentation); void entry.catch(() => {});
  return { record, presentation, entry, attempt: f.attempts.at(-1), viewport: record.viewport };
}
export async function presentLabels(f, options) {
  const active = await startLabelPresentation(f, options);
  await active.attempt.bind(); active.attempt.deliver(); await active.entry;
  return active;
}
export async function finishLabelPresentation(f, active, { recover = true } = {}) {
  const { record, presentation, attempt } = active, old = active.viewport, before = record.viewports.length;
  const exit = presentation.exit(); void exit.catch(() => {});
  attempt.ending.resolve(); await settle();
  assert.equal(record.viewports.length, before, 'End fulfillment alone cannot recover the inline renderer');
  attempt.endEvent(); await until(() => old.renderer.getContext().state.releaseRequests === 1);
  assert.equal(record.viewports.length, before); assert.equal(old.renderer.getContext().isContextLost(), false);
  f.lose(record); await exit;
  if (recover) await until(() => record.viewports.length === before + 1 && callbackCount(record, 'restored') >= before);
  else await settle();
  return record.viewport;
}
