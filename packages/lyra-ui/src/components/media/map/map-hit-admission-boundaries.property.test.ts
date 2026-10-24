import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { mapLayerHittable, queryMapHit, selectMapHit, zoomPaintValue, type MapHit, type MapHitResult } from './map-hit-test.js';

const rules = [{ layerId: 'active', owner: 'overlay' as const }];
const point = { x: 12, y: 24 };
const feature = (properties: unknown = { label: 'Retained' }) => ({ layer: { id: 'active' }, id: 0, properties });
function hit(result: MapHitResult): MapHit {
  expect(result.status).to.equal('hit');
  if (result.status !== 'hit') throw new Error('Expected an admitted hit');
  return result.hit;
}

describe('map hit admission boundaries', () => {
  it('rejects an extra rule field atomically across plain-data inputs and admits the corrected request', () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000000, max: 1000000 }), fc.constantFrom('overlay' as const, 'basemap' as const),
      fc.string({ maxLength: 40 }), fc.integer(), (priority, owner, label, extra) => {
        const allowed = { layerId: 'active', owner, priority };
        const candidate = { layer: { id: 'active' }, id: 0, properties: { label } };
        const invalidRules = [allowed, { layerId: 'other', owner, extra }];
        expect(selectMapHit([candidate], invalidRules, ['active', 'other'])).to.deep.equal({ status: 'invalid', reason: 'rules' });
        let engineCalls = 0;
        const service = {
          getLayer() { engineCalls++; return {}; },
          queryRenderedFeatures() { engineCalls++; return [candidate]; },
        };
        expect(queryMapHit(service, point, invalidRules)).to.deep.equal({ status: 'invalid', reason: 'rules' });
        expect(engineCalls).to.equal(0);
        const selected = hit(selectMapHit([candidate], [allowed], ['active']));
        expect(selected).to.include({ layerId: 'active', owner, id: 0 });
        expect(selected.properties).to.deep.equal({ label });
        expect(Object.isFrozen(selected.properties)).to.equal(true);
        candidate.properties.label = 'Changed after selection';
        expect(selected.properties['label']).to.equal(label);
        expect(hit(queryMapHit(service, point, [allowed])).properties['label']).to.equal('Changed after selection');
        expect(engineCalls).to.equal(2);
      },
    ), propertyRuns());
  });

  it('rejects an incomplete or oversized layer census rather than publishing its valid prefix', () => {
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    for (const existing of [null, {}, ['active', undefined], new Array(1), new Array(4097), revoked.proxy]) {
      expect(selectMapHit([feature()], rules, existing)).to.deep.equal({ status: 'invalid', reason: 'layers' });
    }
    expect(hit(selectMapHit([feature()], rules, ['active'])).id).to.equal(0);
  });

  it('bounds nested copied values and omits later properties after the entry budget is exhausted', () => {
    const samples = Array.from({ length: 9 }, () => Array<number>(128).fill(7));
    const selected = hit(selectMapHit([feature({ samples, after: 'Beyond the budget' })], rules, ['active']));
    const copied = selected.properties['samples'];
    if (!Array.isArray(copied)) throw new Error('Expected retained sample rows');
    expect(copied.length).to.equal(samples.length);
    expect(copied[0]).to.deep.equal(samples[0]);
    expect(copied.at(-1)).to.equal(null);
    expect(copied.flat().filter(value => value === 7).length).to.be.greaterThan(0).and.at.most(1024);
    expect(selected.properties).not.to.have.property('after');
    expect(Object.isFrozen(copied)).to.equal(true);
    expect(Object.isFrozen(copied[0])).to.equal(true);
    samples[0]![0] = 99;
    const first = copied[0];
    if (!Array.isArray(first)) throw new Error('Expected the first retained sample row');
    expect(first[0]).to.equal(7);
  });

  it('omits oversized nested collections and revoked values while preserving ordinary properties', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const properties = {
      tooManyItems: Array<number>(129).fill(1),
      tooManyKeys: Object.fromEntries(Array.from({ length: 129 }, (_, index) => [`key-${index}`, index])),
      revoked: revoked.proxy,
      retained: { value: 7 },
    };
    const selected = hit(selectMapHit([feature(properties)], rules, ['active']));
    expect(selected.properties).to.deep.equal({ retained: { value: 7 } });
    expect(Object.getPrototypeOf(selected.properties)).to.equal(null);
    expect(Object.isFrozen(selected.properties['retained'])).to.equal(true);
  });

  it('cancels during rule or point reflection before calling the engine and releases the query owner', () => {
    for (const stage of ['rules', 'point'] as const) {
      const controller = new AbortController();
      let reflected = 0, engineCalls = 0;
      const cancelOnReflection = <T extends object>(value: T): T => new Proxy(value, {
        getOwnPropertyDescriptor(target, key) {
          reflected++;
          controller.abort();
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      const service = {
        getLayer() { engineCalls++; return {}; },
        queryRenderedFeatures() { engineCalls++; return [feature()]; },
      };
      const candidateRules = stage === 'rules' ? [cancelOnReflection({ ...rules[0]! })] : rules;
      const candidatePoint = stage === 'point' ? cancelOnReflection({ ...point }) : point;
      expect(queryMapHit(service, candidatePoint, candidateRules, { signal: controller.signal })).to.deep.equal({ status: 'stale' });
      expect(reflected).to.be.greaterThan(0);
      expect(engineCalls).to.equal(0);
      expect(hit(queryMapHit(service, point, rules)).id).to.equal(0);
      expect(engineCalls).to.equal(2);
    }
  });

  it('withholds a hit cancelled while copying returned properties and admits the next query', () => {
    const controller = new AbortController();
    let reflections = 0, queries = 0;
    const properties = new Proxy({ label: 'Stale snapshot' }, {
      ownKeys(target) { reflections++; controller.abort(); return Reflect.ownKeys(target); },
    });
    const service = {
      getLayer: () => ({}),
      queryRenderedFeatures() { queries++; return [feature(queries === 1 ? properties : { label: 'Current snapshot' })]; },
    };
    expect(queryMapHit(service, point, rules, { signal: controller.signal })).to.deep.equal({ status: 'stale' });
    expect(reflections).to.equal(1);
    expect(queries).to.equal(1);
    expect(hit(queryMapHit(service, point, rules)).properties['label']).to.equal('Current snapshot');
    expect(queries).to.equal(2);
  });

  it('keeps malformed zoom opacity and unknown layer types conservatively eligible', () => {
    const expressions = [
      ['step', ['get', 'zoom'], 0, 5, 1],
      ['step', ['zoom'], 0, 'five', 1],
      ['interpolate', ['linear'], ['zoom'], 0, 0, Infinity, 1],
      ['interpolate', ['linear'], ['zoom'], 0, NaN, 5, 1],
    ];
    for (const expression of expressions) {
      expect(zoomPaintValue(expression, 3)).to.equal(undefined);
      expect(mapLayerHittable({ getPaintProperty: () => expression }, 'active', { type: 'fill' }, 3)).to.equal(true);
    }
    let reads = 0;
    const reader = { getPaintProperty() { reads++; return 0; } };
    for (const layer of [{ type: 42 }, {}]) expect(mapLayerHittable(reader, 'active', layer, 3)).to.equal(true);
    expect(reads).to.equal(0);
    expect(mapLayerHittable(reader, 'active', { type: 'fill' }, 3)).to.equal(false);
    expect(reads).to.equal(1);
  });
});
