import { expect } from '@open-wc/testing';
import { createMapSceneLineLayer } from './map-scene-line-layer.js';
import type { MapLibreMapCapability } from './map-loader.js';
import type { SceneLineRequest } from './map-scene-line-layer.js';

function request(revision: number): SceneLineRequest {
  return { revision, objects: [], data: { type: 'FeatureCollection', features: [] } };
}
function lineLayerHarness() {
  const canvas = document.createElement('canvas');
  const sources = new Map<string, { data: unknown; setData(data: unknown): void }>();
  const layers = new Map<string, unknown>();
  const map: MapLibreMapCapability = {
    getCanvas: () => canvas, getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => 0,
    setCenter() {}, setZoom() {}, resize() {}, remove() {},
    on() { return this; }, off() { return this; }, once() { return this; }, setStyle() { return this; },
    getSource: id => sources.get(id), getLayer: id => layers.get(id),
    addSource(id, specification) {
      const data = specification && typeof specification === 'object' && 'data' in specification ? specification.data : undefined;
      sources.set(id, { data, setData(value) { this.data = value; } }); return this;
    },
    addLayer(value) {
      if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') throw new TypeError('Invalid layer');
      layers.set(value.id, value); return this;
    },
    removeSource(id) { sources.delete(id); return this; }, removeLayer(id) { layers.delete(id); return this; },
    setPaintProperty() { return this; }, queryRenderedFeatures: () => [],
  };
  let current = true;
  const options = { map, isCurrent: () => current, styleLoaded: () => true, changed: () => {} };
  return { map, sources, layers, options, retire: () => { current = false; }, resume: () => { current = true; } };
}

it('bounds collision checks without overwriting foreign scene resources and can retry', () => {
  const test = lineLayerHarness(), original = test.map.getSource;
  let probes = 0;
  const foreign = { setData() {} };
  test.map.getSource = () => { probes++; return foreign; };
  const layer = createMapSceneLineLayer(test.options);
  try {
    layer.update(request(1));
    expect(layer.capture()).to.deep.equal({ revision: 1, outcome: { state: 'failed', code: 'engine' } });
    expect(probes).to.equal(512); expect(test.sources.size).to.equal(0); expect(test.layers.size).to.equal(0);
    test.map.getSource = original;
    layer.update(request(2));
    expect(layer.capture().outcome.state).to.equal('drawn');
    expect(test.sources.size).to.equal(1); expect(test.layers.size).to.equal(1);
  } finally { layer.dispose(); }
  expect(test.sources.size).to.equal(0); expect(test.layers.size).to.equal(0);
});

it('removes a source whose in-place update fails and recovers on the next request', () => {
  const test = lineLayerHarness(), layer = createMapSceneLineLayer(test.options);
  try {
    layer.update(request(1));
    expect(layer.capture().outcome.state).to.equal('drawn');
    test.sources.values().next().value!.setData = () => { throw new Error('Native source update failed'); };
    layer.update(request(2));
    expect(layer.capture()).to.deep.equal({ revision: 2, outcome: { state: 'failed', code: 'engine' } });
    expect(test.sources.size).to.equal(0); expect(test.layers.size).to.equal(0);
    layer.update(request(3)); expect(layer.capture().outcome.state).to.equal('drawn');
  } finally { layer.dispose(); }
});

for (const method of ['addSource', 'addLayer'] as const) {
  it(`releases a partial installation retired by ${method} and accepts a later request`, () => {
    const test = lineLayerHarness(), original = test.map[method].bind(test.map);
    if (method === 'addSource') {
      const add = test.map.addSource.bind(test.map);
      test.map.addSource = (id, data) => { add(id, data); test.retire(); return test.map; };
    } else {
      const add = test.map.addLayer.bind(test.map);
      test.map.addLayer = (value, before) => { add(value, before); test.retire(); return test.map; };
    }
    const layer = createMapSceneLineLayer(test.options);
    try {
      layer.update(request(1));
      expect(test.sources.size).to.equal(0); expect(test.layers.size).to.equal(0);
      expect(layer.capture().outcome.state).to.equal('pending');
      Reflect.set(test.map, method, original); test.resume();
      layer.update(request(2)); expect(layer.capture().outcome.state).to.equal('drawn');
    } finally { layer.dispose(); }
  });
}

it('preserves a replacement failure published by an in-place source update', () => {
  const test = lineLayerHarness(), layer = createMapSceneLineLayer(test.options);
  try {
    layer.update(request(1));
    test.sources.values().next().value!.setData = () => { layer.update({ revision: 3, failure: 'limit' }); };
    layer.update(request(2));
    expect(layer.capture()).to.deep.equal({ revision: 3, outcome: { state: 'failed', code: 'limit' } });
    expect(test.sources.size).to.equal(0); expect(test.layers.size).to.equal(0);
    layer.update(request(4)); expect(layer.capture().outcome.state).to.equal('drawn');
  } finally { layer.dispose(); }
});

it('contains native canvas, notification and resource cleanup failures', () => {
  const test = lineLayerHarness(); let notifications = 0;
  test.map.getCanvas = () => { throw new Error('Canvas unavailable'); };
  test.options.changed = () => { notifications++; throw new Error('Observer failed'); };
  const layer = createMapSceneLineLayer(test.options);
  layer.update(request(1));
  expect(layer.capture().outcome.state).to.equal('drawn');
  expect(notifications).to.equal(2);
  test.map.removeLayer = id => { test.layers.delete(id); throw new Error('Layer already removed'); };
  test.map.removeSource = id => { test.sources.delete(id); throw new Error('Source already removed'); };
  expect(() => layer.dispose()).not.to.throw();
  expect(() => layer.dispose()).not.to.throw();
  layer.update(request(2)); layer.invalidateStyle(); layer.styleReady();
  expect(layer.capture()).to.deep.equal({ revision: undefined, outcome: { state: 'none' } });
  expect(test.sources.size).to.equal(0); expect(test.layers.size).to.equal(0); expect(notifications).to.equal(2);
});

for (const missing of ['source', 'layer'] as const) {
  it(`rejects an installation whose native ${missing} is not retained`, () => {
    const test = lineLayerHarness();
    if (missing === 'source') test.map.addSource = () => test.map;
    else test.map.addLayer = () => test.map;
    const layer = createMapSceneLineLayer(test.options);
    try {
      layer.update(request(1));
      expect(layer.capture()).to.deep.equal({ revision: 1, outcome: { state: 'failed', code: 'engine' } });
      expect(test.sources.size).to.equal(0); expect(test.layers.size).to.equal(0);
    } finally { layer.dispose(); }
  });
}
