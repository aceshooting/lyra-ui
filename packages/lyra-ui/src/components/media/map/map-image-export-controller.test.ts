import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { MapImageExportController, type MapImageExportHost } from './map-image-export-controller.js';
import type { MapLibreMapCapability } from './map-loader.js';
import type { LyraMapImageExportErrorCode } from './map-image-export-error.js';

async function setup() {
  const element = Object.assign(await fixture<HTMLDivElement>(html`<div></div>`), {
    controls: undefined as unknown,
    whenIdle: async (): Promise<void> => undefined,
  });
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 32;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#275dab'; context.fillRect(0, 0, 64, 32);
  const state = { active: true, features: 0, drawing: 0, pending: false, autoRender: true,
    renders: 0, captures: 0, releases: 0, clears: 0 };
  const failures: LyraMapImageExportErrorCode[] = [];
  let listener: (() => void) | undefined;
  const map: MapLibreMapCapability = {
    getCanvas() { state.captures++; return canvas; }, getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => 1,
    setCenter() {}, setZoom() {}, resize() {}, remove() {},
    on() { return this; }, off() { return this; }, once() { return this; }, setStyle() { return this; },
    getSource: () => undefined, addSource() { return this; }, removeSource() { return this; },
    getLayer: () => undefined, addLayer() { return this; }, removeLayer() { return this; },
    setPaintProperty() { return this; }, queryRenderedFeatures: () => [],
    getStyle: () => ({ layers: [], sources: {} }), isMoving: () => false, loaded: () => true,
    triggerRepaint() { state.renders++; if (state.autoRender) queueMicrotask(() => listener?.()); },
  };
  const host: MapImageExportHost = { element,
    current: () => state.active, generations: () => [state.features, state.drawing], pending: () => state.pending,
    onRender(_map, callback) { listener = callback; return () => { state.releases++; if (listener === callback) listener = undefined; }; },
    clearFeedback() { state.clears++; }, fail(code) { failures.push(code); },
  };
  const controller = new MapImageExportController(host);
  return { element, map, state, failures, controller, render: () => listener?.(),
    export: (options: unknown = { attribution: false }, style = 1) => controller.export({ map, style, connection: 1, options, invalid: false }) };
}

async function failure(work: Promise<Blob>, expected: string): Promise<void> {
  let code: unknown;
  try { await work; } catch (error) { code = (error as { code?: unknown }).code; }
  expect(code).to.equal(expected);
}
async function png(work: Promise<Blob>): Promise<void> {
  const blob = await work;
  expect(blob.type).to.equal('image/png');
  const bitmap = await createImageBitmap(blob);
  try { expect([bitmap.width, bitmap.height]).to.deep.equal([64, 32]); }
  finally { bitmap.close(); }
}

for (const capability of ['triggerRepaint', 'off', 'loaded'] as const) {
  it(`rejects export without native ${capability} and recovers after capability restoration`, async () => {
    const h = await setup();
    const original = h.map[capability];
    Object.defineProperty(h.map, capability, { configurable: true, writable: true, value: undefined });
    try {
      await failure(h.export(), 'not-ready');
      expect([h.state.renders, h.state.captures]).to.deep.equal([0, 0]);
      expect(h.failures).to.deep.equal(['not-ready']);
      Object.defineProperty(h.map, capability, { configurable: true, writable: true, value: original });
      await png(h.export());
      expect(h.state.releases).to.equal(1);
    } finally { h.controller.cancel(); }
  });
}

for (const blocked of ['component work', 'moving camera', 'unloaded map', 'work started by movement probe', 'work started by load probe'] as const) {
  it(`waits for a fresh frame after ${blocked} without capturing stale pixels`, async () => {
    const h = await setup(); h.state.autoRender = false;
    try {
      const work = h.export();
      await waitUntil(() => h.state.renders === 1);
      if (blocked === 'component work') h.state.pending = true;
      if (blocked === 'moving camera') h.map.isMoving = () => true;
      if (blocked === 'unloaded map') h.map.loaded = () => false;
      if (blocked === 'work started by movement probe') h.map.isMoving = () => { h.state.pending = true; return false; };
      if (blocked === 'work started by load probe') h.map.loaded = () => { h.state.pending = true; return true; };
      h.render();
      expect(h.state.captures).to.equal(0);
      expect(h.state.releases).to.equal(0);
      h.state.pending = false; h.map.isMoving = () => false; h.map.loaded = () => true;
      h.render();
      await png(work);
      expect([h.state.captures, h.state.releases]).to.deep.equal([1, 1]);
      expect(h.failures).to.deep.equal([]);
    } finally { h.controller.cancel(); }
  });
}

for (const change of ['features', 'drawing', 'controls', 'connection'] as const) {
  it(`cancels an outstanding frame after ${change} changes and admits a fresh export`, async () => {
    const h = await setup(); h.state.autoRender = false;
    try {
      const outcome = failure(h.export(), 'cancelled');
      await waitUntil(() => h.state.renders === 1);
      if (change === 'features') h.state.features++;
      if (change === 'drawing') h.state.drawing++;
      if (change === 'controls') h.element.controls = [];
      if (change === 'connection') h.state.active = false;
      h.render(); await outcome;
      expect([h.state.captures, h.state.releases]).to.deep.equal([0, 1]);
      h.state.active = true; h.state.autoRender = true;
      await png(h.export());
      expect([h.state.captures, h.state.releases]).to.deep.equal([1, 2]);
    } finally { h.controller.cancel(); }
  });
}

it('shares an idle wait only with its current owner and clears a failed readiness attempt', async () => {
  const h = await setup();
  h.element.whenIdle = () => Promise.reject(new Error('Private native diagnostic'));
  try {
    await failure(h.export(), 'not-ready');
    expect(h.state.captures).to.equal(0);
    h.element.whenIdle = async () => undefined;
    await png(h.export());
    expect(h.state.clears).to.equal(2);
    expect(h.failures).to.deep.equal(['not-ready']);
  } finally { h.controller.cancel(); }
});

it('cancels a previous style export without reporting its failure against the new owner', async () => {
  const h = await setup(); h.state.autoRender = false;
  try {
    const previous = failure(h.export(), 'cancelled');
    await waitUntil(() => h.state.renders === 1);
    h.state.autoRender = true;
    const next = h.export({ attribution: false }, 2);
    await previous; await png(next);
    expect(h.failures).to.deep.equal([]);
    expect([h.state.captures, h.state.releases]).to.deep.equal([1, 2]);
  } finally { h.controller.cancel(); }
});

it('rejects an already stale request before clearing feedback or waiting for readiness', async () => {
  const h = await setup(); h.state.active = false;
  let waits = 0; h.element.whenIdle = async () => { waits++; };
  try {
    await failure(h.export(), 'cancelled');
    expect([waits, h.state.clears, h.state.renders, h.state.captures]).to.deep.equal([0, 0, 0, 0]);
    expect(h.failures).to.deep.equal([]);
  } finally { h.controller.cancel(); }
});
