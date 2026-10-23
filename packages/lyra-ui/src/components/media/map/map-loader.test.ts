import { expect } from '@open-wc/testing';
import { loadMaplibre, loadMaplibreModule, loadModularMap, loadModularMapModule, type MaplibreModule } from './map-loader.js';

const MAP_METHODS = [
  'getCanvas',
  'getCenter',
  'getZoom',
  'setCenter',
  'setZoom',
  'resize',
  'remove',
  'on',
  'once',
  'setStyle',
  'getSource',
  'addSource',
  'removeSource',
  'getLayer',
  'addLayer',
  'removeLayer',
  'setPaintProperty',
  'queryRenderedFeatures',
] as const;
const MARKER_METHODS = ['setLngLat', 'setPopup', 'getPopup', 'addTo', 'remove'] as const;
const POPUP_METHODS = ['setHTML', 'setText'] as const;

function fakeConstructor(methods: readonly string[]): new (...args: never[]) => object {
  class Capability {}
  for (const method of methods) {
    Object.defineProperty(Capability.prototype, method, {
      value() {},
      configurable: true,
    });
  }
  return Capability;
}

function fakeMaplibreModule(): MaplibreModule {
  return {
    Map: fakeConstructor(MAP_METHODS),
    Marker: fakeConstructor(MARKER_METHODS),
    Popup: fakeConstructor(POPUP_METHODS),
  } as unknown as MaplibreModule;
}

it('resolves the maplibre-gl module', async () => {
  const mod = await loadMaplibre();
  expect(mod).to.not.be.null;
  expect(mod!.Map).to.exist;
  const peer = await import('maplibre-gl');
  expect(mod!.Map).to.equal(peer.Map);
  expect(mod!.Marker).to.equal(peer.Marker);
  expect(mod!.Popup).to.equal(peer.Popup);
  expect(mod!.NavigationControl).to.equal(peer.NavigationControl);
  expect(mod!.ScaleControl).to.equal(peer.ScaleControl);
  expect(mod!.GeolocateControl).to.equal(peer.GeolocateControl);
  expect(mod!.AttributionControl).to.equal(peer.AttributionControl);
  const runtime = mod as unknown as { setWorkerUrl: unknown; getVersion(): string };
  expect(runtime.setWorkerUrl).to.be.a('function');
  expect(runtime.getVersion()).to.match(/^6\./);
});

it('caches the module — a second call returns the same promise result', async () => {
  const first = loadMaplibre();
  const second = loadMaplibre();
  expect(first === second).to.be.true;
  const a = await first;
  const b = await second;
  expect(a).to.equal(b);
  expect((await loadMaplibreModule()) === a).to.be.true;
  expect((await loadMaplibreModule()) === a).to.be.true;
});

it('normalizes a default-wrapped MapLibre module and prefers a valid named namespace', async () => {
  const fallback = fakeMaplibreModule();
  expect(
    (await loadMaplibreModule(() => Promise.resolve({ default: fallback }))) === fallback,
  ).to.be.true;

  const named = fakeMaplibreModule();
  const mixed = Object.assign(named, { default: fallback });
  expect((await loadMaplibreModule(() => Promise.resolve(mixed))) === named).to.be.true;
});

it('accepts a callable module namespace when it exposes the complete constructor surface', async () => {
  const callable = Object.assign(function MaplibreNamespace() {}, fakeMaplibreModule());
  expect((await loadMaplibreModule(() => Promise.resolve(callable))) === callable).to.be.true;
});

it('fails closed with a clear Error for every consumed MapLibre constructor/method', async () => {
  const MapWithoutPrototype = function () {} as unknown as new (...args: never[]) => object;
  Object.defineProperty(MapWithoutPrototype, 'prototype', { value: null });
  const malformedCases: Array<[string, unknown]> = [
    ['module namespace', null],
    ['Map', { ...fakeMaplibreModule(), Map: () => ({}) }],
    ['Map.prototype', { ...fakeMaplibreModule(), Map: MapWithoutPrototype }],
    ['Marker', { ...fakeMaplibreModule(), Marker: () => ({}) }],
    ['Popup', { ...fakeMaplibreModule(), Popup: () => ({}) }],
  ];
  for (const [constructor, methods] of [
    ['Map', MAP_METHODS],
    ['Marker', MARKER_METHODS],
    ['Popup', POPUP_METHODS],
  ] as const) {
    for (const method of methods) {
      const malformed = fakeMaplibreModule() as unknown as Record<
        string,
        { prototype: object }
      >;
      const Constructor = malformed[constructor]!;
      Object.defineProperty(Constructor.prototype, method, { value: undefined });
      malformedCases.push([`${constructor}.prototype.${method}`, malformed]);
    }
  }

  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    for (const [capability, malformed] of malformedCases) {
      warnings.length = 0;
      const result = await loadMaplibreModule(() => Promise.resolve(malformed));
      expect(result === null, capability).to.be.true;
      const error = warnings.flat().find((value) => value instanceof Error) as Error | undefined;
      expect(error instanceof Error, capability).to.be.true;
      expect(error!.message, capability).to.contain('maplibre-gl');
      expect(error!.message, capability).to.contain(capability);
    }
  } finally {
    console.warn = originalWarn;
  }
});

it('rejects malformed named and default-wrapped MapLibre namespaces', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    expect((await loadMaplibreModule(() => Promise.resolve({ Map: class {} }))) === null).to.be.true;
    expect(
      (await loadMaplibreModule(() => Promise.resolve({ default: { Marker: class {} } }))) === null,
    ).to.be.true;
  } finally {
    console.warn = originalWarn;
  }
});


it('loads the modular companion with the same runtime Map identity and caches its result', async () => {
  const first = loadModularMap();
  expect(loadModularMap() === first).to.be.true;
  const module = await first;
  const companion = await import('@aceshooting/lyra-map');
  expect((module?.Map as unknown) === companion.Map).to.be.true;
  expect((module?.Marker as unknown) === companion.Marker).to.be.true;
  expect((module?.Popup as unknown) === companion.Popup).to.be.true;
  expect(typeof module?.Map.prototype.prepareFeatures).to.equal('function');
});

it('requires per-map feature readiness on the modular peer and accepts valid default interop', async () => {
  const candidate = fakeMaplibreModule();
  const warnings: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    expect(await loadModularMapModule(async () => candidate)).to.equal(null);
    expect(warnings.flat().some(value => value instanceof Error && value.message.includes('Map.prototype.prepareFeatures'))).to.be.true;
    Object.defineProperty(candidate.Map.prototype, 'prepareFeatures', { value: async () => {} });
    expect(await loadModularMapModule(async () => ({ default: candidate }))).to.equal(candidate);
    const named = Object.assign(candidate, { default: fakeMaplibreModule() });
    expect(await loadModularMapModule(async () => named)).to.equal(named);
  } finally { console.warn = warn; }
});

it('fails closed when the selected modular companion cannot load', async () => {
  const warn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    let attempts = 0;
    const result = await loadModularMapModule(async () => { attempts++; throw new Error('companion unavailable'); });
    expect(result).to.equal(null);
    expect(attempts).to.equal(1);
    expect(warnings.flat().some(value => typeof value === 'string' && value.includes('@aceshooting/lyra-map'))).to.be.true;
  } finally { console.warn = warn; }
});
