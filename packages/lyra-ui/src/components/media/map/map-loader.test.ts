import { expect } from '@open-wc/testing';
import { loadMaplibre, loadMaplibreModule, type MaplibreModule } from './map-loader.js';

const MAP_METHODS = [
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
  const runtime = mod as unknown as { setWorkerUrl: unknown; getVersion(): string };
  expect(runtime.setWorkerUrl).to.be.a('function');
  expect(runtime.getVersion()).to.match(/^6\./);
});

it('caches the module — a second call returns the same promise result', async () => {
  const a = await loadMaplibre();
  const b = await loadMaplibre();
  expect(a).to.equal(b);
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

it('fails closed with a clear Error for every consumed MapLibre constructor/method', async () => {
  const malformedCases: Array<[string, unknown]> = [
    ['Map', { ...fakeMaplibreModule(), Map: () => ({}) }],
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
