import { expect } from '@open-wc/testing';
import { MapFeatureStateRouter } from './map-feature-state-router.js';

const route = (extra: Record<string, unknown> = {}) => ({ origin: 'data-layer', source: 'roads', nativeSource: 'native-roads', identity: 'v1', ...extra });

describe('map feature-state hit routing', () => {
  it('resolves a hit target to its public origin and freezes the answer', () => {
    const router = new MapFeatureStateRouter();
    expect(router.configure([route(), route({ origin: 'overlay', source: 'pins', nativeSource: 'native-pins', identity: 'v2' })])).to.equal(true);
    const target = router.resolve({ source: 'roads', id: 7 });
    expect(target).to.deep.equal({ origin: 'data-layer', source: 'roads', id: 7 });
    expect(Object.isFrozen(target)).to.equal(true);
    expect(router.resolve({ origin: 'overlay', source: 'pins', id: 'a' })).to.deep.equal({ origin: 'overlay', source: 'pins', id: 'a' });
    expect(router.resolve({ origin: 'basemap', source: 'roads', id: 7 })).to.equal(undefined);
  });

  it('requires the exact vector source layer and refuses one for a GeoJSON route', () => {
    const router = new MapFeatureStateRouter();
    router.configure([route({ source: 'tiles', sourceLayers: ['roads', 'bridges'] }), route({ source: 'points', identity: 'v2' })]);
    expect(router.resolve({ source: 'tiles', sourceLayer: 'bridges', id: 1 })).to.deep.equal({ origin: 'data-layer', source: 'tiles', sourceLayer: 'bridges', id: 1 });
    expect(router.resolve({ source: 'tiles', id: 1 })).to.equal(undefined);
    expect(router.resolve({ source: 'tiles', sourceLayer: 'rivers', id: 1 })).to.equal(undefined);
    expect(router.resolve({ source: 'points', id: 1 })).to.deep.equal({ origin: 'data-layer', source: 'points', id: 1 });
    expect(router.resolve({ source: 'points', sourceLayer: 'roads', id: 1 })).to.equal(undefined);
  });

  it('rejects a route list atomically, leaving no routes behind', () => {
    const router = new MapFeatureStateRouter();
    const symbolic = { ...route(), [Symbol('extra')]: true };
    const invalid: Record<string, unknown> = {
      'a non-array list': route(),
      'a non-record row': [null],
      'an unknown member': [route({ extra: true })],
      'a symbol member': [symbolic],
      'a blank source layer': [route({ sourceLayers: ['roads', ' '] })],
      'a non-string source layer': [route({ sourceLayers: ['roads', 4] })],
      'an empty source layer list': [route({ sourceLayers: [] })],
      'a repeated source layer': [route({ sourceLayers: ['roads', 'roads'] })],
      'a duplicate route': [route(), route()],
    };
    for (const [name, input] of Object.entries(invalid)) {
      expect(router.configure([route()]), name).to.equal(true);
      expect(router.configure(input), name).to.equal(false);
      expect(router.resolve({ source: 'roads', id: 1 }), name).to.equal(undefined);
    }
  });

  it('resolves nothing for malformed or unroutable hit targets', () => {
    const router = new MapFeatureStateRouter();
    router.configure([route()]);
    const rejected: Record<string, unknown> = {
      'a missing target': null,
      'a blank source': { source: ' ', id: 1 },
      'an oversized source': { source: 'x'.repeat(129), id: 1 },
      'a non-string source': { source: 7, id: 1 },
      'an object id': { source: 'roads', id: {} },
      'a non-finite id': { source: 'roads', id: Number.NaN },
      'an oversized id': { source: 'roads', id: 'x'.repeat(1025) },
      'a non-string origin': { source: 'roads', origin: 7, id: 1 },
      'an unknown origin': { source: 'roads', origin: 'nowhere', id: 1 },
      'an unknown source': { source: 'rivers', id: 1 },
    };
    for (const [name, input] of Object.entries(rejected)) expect(router.resolve(input), name).to.equal(undefined);
    expect(router.resolve({ source: 'roads', id: 'x'.repeat(1024) })?.id).to.equal('x'.repeat(1024));
    expect(router.resolve({ source: 'roads', id: 0 })?.id).to.equal(0);
  });
});
