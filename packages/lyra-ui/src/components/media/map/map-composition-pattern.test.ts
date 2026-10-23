import { expect } from '@open-wc/testing';
import { composeMapModules, createMapModule, createMapModuleDemo, createMapModulePublisher, MAP_MODULE_ORDER } from '../../../../test/map-module-composition.js';
import type { MapModules } from '../../../../test/map-module-composition.js';
import type { LyraMapOverlays } from './map.js';

describe('application map module composition example', () => {
  it('orders eight modules explicitly and preserves descriptors and large data by identity', () => {
    const modules = createMapModuleDemo('red');
    const result = composeMapModules(modules);
    expect(result.sources?.map(entry => entry.id)).to.deep.equal(MAP_MODULE_ORDER.map(name => `city:${name}:data`));
    expect(Object.isFrozen(result)).to.equal(true); expect(Object.isFrozen(result.sources)).to.equal(true);
    for (const [index, name] of MAP_MODULE_ORDER.entries()) {
      expect(result.sources?.[index] === modules[name]?.sources[0]).to.equal(true);
      expect(result.sources?.[index]?.source['data'] === modules[name]?.sources[0]?.source['data']).to.equal(true);
      expect(result.layers?.[index] === modules[name]?.layers[0]).to.equal(true);
    }
  });

  it('assigns once per aggregate change, keeps unrelated identity and removes a module', () => {
    const assigned: LyraMapOverlays[] = []; const publish = createMapModulePublisher(value => assigned.push(value));
    const first = createMapModuleDemo('red'); publish(first);
    expect(publish({ ...first })).to.equal(false);
    const roads = createMapModule('roads', first.roads!.sources[0]!.source['data'] as object, 'blue');
    publish({ ...first, roads });
    expect(assigned.length).to.equal(2);
    expect(assigned[1]?.sources?.[0] === assigned[0]?.sources?.[0]).to.equal(true);
    expect(assigned[1]?.sources?.[2]?.source['data'] === assigned[0]?.sources?.[2]?.source['data']).to.equal(true);
    const { alerts: _removed, ...remaining } = { ...first, roads };
    publish(remaining);
    expect(assigned.length).to.equal(3);
    expect(assigned[2]?.sources?.some(entry => entry.id === 'city:alerts:data')).to.equal(false);
    expect(assigned[2]?.layers?.some(entry => entry.layer.id === 'city:alerts:fill')).to.equal(false);
  });

  it('rejects duplicate IDs and missing cross-module dependencies before any assignment', () => {
    const modules = createMapModuleDemo('red'); const assigned: LyraMapOverlays[] = [];
    const publish = createMapModulePublisher(value => assigned.push(value)); publish(modules);
    const invalid = [
      { ...modules, roads: modules.districts },
      { ...modules, roads: { sources: [], layers: modules.districts!.layers } },
      { ...modules, roads: { sources: [], layers: [{ layer: { id: 'unique', type: 'fill', source: 'missing' } }] } },
      { ...modules, roads: { sources: [], layers: [{ before: 'missing', layer: { id: 'unique', type: 'background' } }] } },
    ];
    const diagnostics = ['duplicate-source:city:districts:data', 'duplicate-layer:city:districts:fill', 'missing-source:missing', 'missing-layer:missing'];
    invalid.forEach((value, index) => expect(() => publish(value)).to.throw(diagnostics[index]));
    expect(assigned.length).to.equal(1); expect(publish(modules)).to.equal(false);
  });

  it('admits cross-module dependencies independent of publication order and rejects their removal', () => {
    const modules = createMapModuleDemo('red');
    const selection = Object.freeze({ sources: Object.freeze([]), layers: Object.freeze([
      Object.freeze({ before: 'city:alerts:fill', layer: Object.freeze({ id: 'city:selection:outline', type: 'line', source: 'city:districts:data' }) }),
    ]) });
    expect(composeMapModules({ ...modules, selection }).layers?.length).to.equal(8);
    expect(() => composeMapModules({ ...modules, selection, alerts: undefined })).to.throw('missing-layer:city:alerts:fill');
    expect(() => composeMapModules({ ...modules, selection, districts: undefined })).to.throw('missing-source:city:districts:data');
  });
});


describe('application composition preflight', () => {
  it('rejects cycles, noncanonical IDs and aggregate count/value/text/depth limits before publication', () => {
    const first = createMapModuleDemo('red'); const assigned: LyraMapOverlays[] = [];
    const publish = createMapModulePublisher(value => assigned.push(value)); publish(first);
    const layer = (id: string, before?: string) => ({ layer: { id, type: 'background' }, ...(before ? { before } : {}) });
    const rejected: MapModules[] = [
      { ...first, selection: { sources: [], layers: [layer('cycle:a', 'cycle:b'), layer('cycle:b', 'cycle:a')] } },
      { ...first, selection: { sources: [{ id: ' city:districts:data ', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }], layers: [] } },
      { ...first, selection: { sources: [], layers: Array.from({ length: 129 }, (_, index) => layer(`large:${index}`)) } },
      { ...first, selection: { sources: [], layers: [{ layer: { id: 'large', type: 'background', metadata: { large: 'x'.repeat(1_048_577) } } }] } },
      { ...first, selection: { sources: [], layers: [{ layer: { id: 'large', type: 'background', metadata: Array.from({ length: 6 }, () => Array.from({ length: 9000 }, () => 0)) } }] } },
    ];
    let deep: object = {};
    for (let i = 0; i < 25; i++) deep = { next: deep };
    rejected.push({ ...first, selection: { sources: [], layers: [{ layer: { id: 'deep', type: 'background', metadata: deep } }] } });
    for (const value of rejected) {
      expect(() => publish(value)).to.throw(); expect(assigned.length).to.equal(1); expect(publish(first)).to.equal(false);
    }
  });

  it('resolves forward cross-module dependencies and leaves huge opaque GeoJSON outside descriptor budgets', () => {
    const modules = createMapModuleDemo('red');
    const districts = { sources: [], layers: [{ before: 'city:selection:fill', layer: { id: 'forward', type: 'line', source: 'city:selection:data' } }] };
    const result = composeMapModules({ ...modules, districts });
    expect(result.layers?.[0]?.layer.id).to.equal('forward');
    const data = { type: 'FeatureCollection', features: [], unused: 'x'.repeat(1_048_577) };
    const huge = { sources: [{ id: 'opaque', source: { type: 'geojson', data } }], layers: [] };
    expect(composeMapModules({ districts: huge }).sources?.[0]?.source['data'] === data).to.equal(true);
  });
});


describe('application GeoJSON preflight parity', () => {
  it('rejects forbidden source keys and over-budget non-envelope geometry without assigning or caching', () => {
    const initial = createMapModuleDemo('red'); const assigned: LyraMapOverlays[] = [];
    const publish = createMapModulePublisher(value => assigned.push(value)); publish(initial);
    const invalidSources: ReadonlyArray<NonNullable<LyraMapOverlays['sources']>[number]['source']> = [
      { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, constructor: 1 },
      { type: 'geojson', data: { type: 'Feature', geometry: ['x'.repeat(1_048_577)] } },
      { type: 'geojson', data: { type: 'Feature', geometry: new Date() } },
    ];
    for (const source of invalidSources) {
      const invalid = { ...initial, districts: { sources: [{ id: 'invalid', source }], layers: [] } };
      expect(() => publish(invalid)).to.throw();
      expect(assigned.length).to.equal(1); expect(publish(initial)).to.equal(false);
    }
    const data = { type: 'Feature', geometry: null, opaque: 'x'.repeat(1_048_577) };
    const valid = { ...initial, districts: { sources: [{ id: 'valid', source: { type: 'geojson', data } }], layers: [] } };
    publish(valid); expect(assigned.length).to.equal(2);
    expect(assigned[1]?.sources?.[0]?.source['data'] === data).to.equal(true);
  });
});
