import { expect, fixture } from '@open-wc/testing';
import { admitMapHitRules, mapLayerHittable, queryMapHit, selectMapHit, zoomPaintValue, type MapHitRule } from './map-hit-test.js';

const rules: readonly MapHitRule[] = [
  { layerId: 'area', owner: 'overlay', interactive: true, priority: 0 },
  { layerId: 'point', owner: 'overlay', interactive: true, priority: 2 },
  { layerId: 'building', owner: 'basemap', interactive: true, priority: 1 },
  { layerId: 'disabled', owner: 'overlay', interactive: false, priority: 100 },
];
const feature = (layerId: string, id: number | string = 0) => ({ layer: { id: layerId }, source: 'tiles', sourceLayer: 'buildings', id, properties: { name: 'Place' } });

describe('map hit selection', () => {
  it('admits immutable rule snapshots and rejects invalid/duplicate rules atomically', () => {
    const input = [{ layerId: 'a', owner: 'overlay' }]; const admitted = admitMapHitRules(input);
    expect(admitted.status).to.equal('ready'); if (admitted.status !== 'ready') return;
    input[0]!.layerId = 'changed'; expect(admitted.rules[0]).to.deep.equal({ layerId: 'a', owner: 'overlay', interactive: true, priority: 0 });
    expect(Object.isFrozen(admitted.rules[0])).to.equal(true);
    for (const value of [[...rules, rules[0]], [{ layerId: 'x', owner: 'unknown' }], [{ layerId: 'x', owner: 'basemap', priority: Infinity }],
      [{ layerId: 'x', owner: 'basemap', priority: 1000001 }], [{ layerId: 'x', owner: 'basemap', interactive: 'yes' }], Array(2), Array.from({ length: 4097 }, (_, i) => ({ layerId: `${i}`, owner: 'overlay' }))]) {
      expect(admitMapHitRules(value).status).to.equal('invalid');
    }
  });

  it('never invokes rule getters and rejects prototype-backed rule records', () => {
    let reads = 0; const getter = { get layerId() { reads++; return 'x'; }, owner: 'overlay' };
    expect(admitMapHitRules([getter]).status).to.equal('invalid'); expect(reads).to.equal(0);
    expect(admitMapHitRules([Object.create({ layerId: 'x', owner: 'overlay' })]).status).to.equal('invalid');
    const throwing = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } });
    expect(admitMapHitRules([throwing]).status).to.equal('invalid');
  });

  it('admits own plain rule records from another window realm', async () => {
    const frame = await fixture<HTMLIFrameElement>('<iframe></iframe>');
    const RealmObject = (frame.contentWindow as unknown as { Object: ObjectConstructor }).Object;
    const rule = Object.assign(new RealmObject(), { layerId: 'point', owner: 'basemap' });
    const result = admitMapHitRules([rule]); expect(result.status).to.equal('ready');
    if (result.status === 'ready') expect(result.rules[0]!.layerId).to.equal('point');
  });

  it('bounds same-service recursive queries from existence, query and generation callbacks', () => {
    const nested: string[] = []; let queries = 0;
    const point = { x: 1, y: 2 };
    const service = {
      getLayer() { nested.push(queryMapHit(service, point, rules).status); return {}; },
      queryRenderedFeatures() { queries++; nested.push(queryMapHit(service, point, rules).status); return [feature('point')]; },
    };
    const result = queryMapHit(service, point, rules, { current() { nested.push(queryMapHit(service, point, rules).status); return true; } });
    expect(result.status).to.equal('hit'); expect(queries).to.equal(1);
    expect(nested.length).to.be.greaterThan(3); expect(nested.every((value) => value === 'stale')).to.equal(true);
    // The guard is released on both normal and exceptional paths.
    expect(queryMapHit(service, point, rules).status).to.equal('hit'); expect(queries).to.equal(2);
    let fail = true;
    const throwing = { getLayer() { if (fail) throw new Error('first'); return {}; }, queryRenderedFeatures() { return []; } };
    expect(queryMapHit(throwing, point, rules).status).to.equal('query-error'); fail = false;
    expect(queryMapHit(throwing, point, rules).status).to.equal('none');
  });

  it('uses highest priority then original topmost order, never ownership or rule order', () => {
    const values = [feature('area', 'top'), feature('building'), feature('point', 'winner'), feature('point', 'later')];
    const result = selectMapHit(values, rules, ['area', 'point', 'building']);
    expect(result.status).to.equal('hit'); if (result.status === 'hit') expect(result.hit.id).to.equal('winner');
    const tied = selectMapHit([feature('building', 'top'), feature('area', 'lower')], rules.map((rule) => ({ ...rule, priority: 0 })), ['area', 'building']);
    expect(tied.status).to.equal('hit'); if (tied.status === 'hit') expect(tied.hit.id).to.equal('top');
  });

  it('excludes disabled, missing and unopted layers even when returned by the engine', () => {
    const values = [feature('unopted'), feature('disabled'), feature('point'), feature('area', 'allowed')];
    const result = selectMapHit(values, rules, ['disabled', 'area']);
    expect(result.status).to.equal('hit'); if (result.status === 'hit') expect(result.hit.id).to.equal('allowed');
    expect(selectMapHit(values.slice(0, 3), rules, ['disabled', 'area']).status).to.equal('none');
  });

  it('retains source-layer identity and ID zero plus bounded cluster properties without caller ownership', () => {
    const properties = { cluster: true, cluster_id: 0, point_count: 12, nested: { values: ['a', 2, null] } };
    const candidate = { ...feature('point'), properties };
    const result = selectMapHit([candidate], rules, ['point']); expect(result.status).to.equal('hit');
    if (result.status !== 'hit') return;
    expect(result.hit).to.include({ layerId: 'point', owner: 'overlay', source: 'tiles', sourceLayer: 'buildings', id: 0 });
    expect(result.hit.properties).to.deep.equal(properties); properties.nested.values[0] = 'changed';
    expect((result.hit.properties['nested'] as { values: readonly unknown[] }).values[0]).to.equal('a');
    expect(Object.isFrozen(result.hit.properties)).to.equal(true); expect(Object.isFrozen(result.hit)).to.equal(true);
    for (const identity of ['0', '', -1.5]) { const text = selectMapHit([feature('point', identity)], rules, ['point']); expect(text.status).to.equal('hit'); if (text.status === 'hit') expect(text.hit.id).to.equal(identity); }
  });

  it('returns the same frozen null-prototype properties record when a feature has no usable properties', () => {
    const populated = selectMapHit([feature('point')], rules, ['point']); expect(populated.status).to.equal('hit');
    if (populated.status === 'hit') expect(Object.getPrototypeOf(populated.hit.properties) === null).to.equal(true);
    for (const properties of [undefined, null, 'text', 7, [1, 2]]) {
      const candidate: Record<string, unknown> = { layer: { id: 'point' }, source: 'tiles' };
      if (properties !== undefined) candidate['properties'] = properties;
      const result = selectMapHit([candidate], rules, ['point']); expect(result.status).to.equal('hit');
      if (result.status !== 'hit') continue;
      expect(Object.getPrototypeOf(result.hit.properties) === null, `prototype for ${JSON.stringify(properties)}`).to.equal(true);
      expect(Object.keys(result.hit.properties).length).to.equal(0); expect(Object.isFrozen(result.hit.properties)).to.equal(true);
    }
  });

  it('reads own feature descriptors only, tolerating wrapper prototypes without invoking accessors', () => {
    let reads = 0; const candidate = Object.assign(Object.create({ id: 77, source: 'inherited' }), { layer: { id: 'point' }, properties: { good: 1, get bad() { reads++; return 2; } } });
    Object.defineProperty(candidate, 'sourceLayer', { get() { reads++; return 'private'; } });
    const result = selectMapHit([candidate], rules, ['point']); expect(result.status).to.equal('hit');
    if (result.status === 'hit') { expect(result.hit.id).to.equal(undefined); expect(result.hit.source).to.equal(undefined); expect(result.hit.sourceLayer).to.equal(undefined); expect(result.hit.properties).to.deep.equal({ good: 1 }); }
    expect(reads).to.equal(0);
    const unsafe = { get layer() { reads++; return { id: 'point' }; } };
    expect(selectMapHit([unsafe], rules, ['point'])).to.deep.equal({ status: 'invalid', reason: 'features' }); expect(reads).to.equal(0);
  });

  it('bounds hostile property trees, cycles, unsafe IDs and oversized query results', () => {
    const properties: Record<string, unknown> = { huge: 'x'.repeat(4097), invalid: NaN, fn: () => 1, normal: 'ok' }; properties['cycle'] = properties;
    const result = selectMapHit([{ ...feature('point', Infinity), properties }], rules, ['point']);
    expect(result.status).to.equal('hit'); if (result.status === 'hit') { expect(result.hit.id).to.equal(undefined); expect(result.hit.properties['huge']).to.equal(undefined); expect(result.hit.properties['normal']).to.equal('ok'); expect(result.hit.properties['cycle']).to.equal(undefined); }
    expect(selectMapHit(Array(10001), rules, ['point']).status).to.equal('invalid');
    expect(selectMapHit({}, rules, ['point']).status).to.equal('invalid');
    expect(selectMapHit([], rules, ['point']).status).to.equal('none');
  });

  it('caps copied property characters, depth and values instead of retaining a large feature payload', () => {
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) properties[`field-${i}`] = 'x'.repeat(4096);
    properties['deep'] = { a: { b: { c: { d: { e: 'beyond depth' } } } } };
    const result = selectMapHit([{ ...feature('point'), properties }], rules, ['point']);
    expect(result.status).to.equal('hit'); if (result.status !== 'hit') return;
    let characters = 0, entries = 0;
    const visit = (value: unknown): void => {
      entries++;
      if (typeof value === 'string') characters += value.length;
      else if (value !== null && typeof value === 'object') for (const [key, entry] of Object.entries(value)) { characters += key.length; visit(entry); }
    };
    visit(result.hit.properties);
    expect(characters).to.be.at.most(65536); expect(entries).to.be.at.most(1024);
    expect(Object.keys(result.hit.properties).length).to.be.greaterThan(0).and.lessThan(100);
    const deep = selectMapHit([{ ...feature('point'), properties: { a: { b: { c: { d: { e: 'beyond depth' } } } } } }], rules, ['point']);
    expect(deep.status).to.equal('hit');
    if (deep.status === 'hit') expect(JSON.stringify(deep.hit.properties)).not.to.include('beyond depth');
  });

  it('queries only existing enabled IDs and distinguishes no hit from query failure', () => {
    const checked: string[] = [], queried: string[][] = [];
    const service = { getLayer(id: string) { checked.push(id); return id === 'point' ? {} : undefined; },
      queryRenderedFeatures(_point: { x: number; y: number }, options: { layers: readonly string[] }) { queried.push([...options.layers]); return [feature('point')]; } };
    expect(queryMapHit(service, { x: 1, y: 2 }, rules).status).to.equal('hit');
    expect(checked).to.deep.equal(['area', 'point', 'building']); expect(queried).to.deep.equal([['point']]);
    expect(queryMapHit({ getLayer: () => undefined, queryRenderedFeatures() { throw new Error('must not query'); } }, { x: 0, y: 0 }, rules).status).to.equal('none');
    expect(queryMapHit({ getLayer: () => ({}), queryRenderedFeatures() { throw new Error('engine failure'); } }, { x: 0, y: 0 }, rules).status).to.equal('query-error');
    expect(queryMapHit(service, { x: NaN, y: 0 }, rules).status).to.equal('invalid');
  });

  it('does not invoke service accessors and stops if method reflection cancels the query', () => {
    let reads = 0, calls = 0;
    const accessor = { get getLayer() { reads++; return () => { calls++; return {}; }; }, queryRenderedFeatures() { return []; } };
    expect(queryMapHit(accessor, { x: 0, y: 0 }, rules).status).to.equal('query-error'); expect(reads).to.equal(0); expect(calls).to.equal(0);
    let current = true;
    const service = new Proxy({ getLayer() { calls++; return {}; }, queryRenderedFeatures() { calls++; return []; } }, {
      getOwnPropertyDescriptor(value, key) { current = false; return Object.getOwnPropertyDescriptor(value, key); },
    });
    expect(queryMapHit(service, { x: 0, y: 0 }, rules, { current: () => current }).status).to.equal('stale'); expect(calls).to.equal(0);
  });

  it('rejects aborted and reentrant queries after each external callback', () => {
    const controller = new AbortController(); controller.abort(); let queries = 0;
    const service = { getLayer: () => ({}), queryRenderedFeatures() { queries++; return [feature('point')]; } };
    expect(queryMapHit(service, { x: 0, y: 0 }, rules, { signal: controller.signal }).status).to.equal('stale'); expect(queries).to.equal(0);
    let current = true;
    expect(queryMapHit({ ...service, getLayer() { current = false; return {}; } }, { x: 0, y: 0 }, rules, { current: () => current }).status).to.equal('stale'); expect(queries).to.equal(0);
    current = true;
    expect(queryMapHit({ ...service, queryRenderedFeatures() { current = false; return [feature('point')]; } }, { x: 0, y: 0 }, rules, { current: () => current }).status).to.equal('stale');
  });
});

it('returns the exact original query index of a higher-priority lower feature', () => {
  const result = selectMapHit([feature('area', 1), feature('point', 2)], [
    { layerId: 'area', owner: 'overlay', priority: 0 }, { layerId: 'point', owner: 'overlay', priority: 3 },
  ], ['area', 'point']);
  expect(result.status).to.equal('hit'); if (result.status === 'hit') expect(result.featureIndex).to.equal(1);
});

it('rejects malformed queried feature identities without evaluating accessors or authorizing background', () => {
  let reads = 0;
  const accessor = { get layer() { reads++; return { id: 'point' }; } };
  const layerAccessor = { layer: { get id() { reads++; return 'point'; } } };
  for (const features of [new Array(1), [null], [{}], [accessor], [layerAccessor], [{ layer: { id: 42 } }]]) {
    expect(selectMapHit(features, [{ layerId: 'point', owner: 'overlay' }], ['point'])).to.deep.equal({ status: 'invalid', reason: 'features' });
  }
  expect(reads).to.equal(0);
  expect(selectMapHit([feature('unknown')], [{ layerId: 'point', owner: 'overlay' }], ['point'])).to.deep.equal({ status: 'none' });
});

it('rejects native query rows outside its exact live enabled request while standalone selection filters them', () => {
  const rules = [{ layerId: 'point', owner: 'overlay' as const }, { layerId: 'disabled', owner: 'overlay' as const, interactive: false }, { layerId: 'missing', owner: 'basemap' as const }];
  for (const id of ['unknown', 'disabled', 'missing']) {
    const service = { getLayer: (layer: string) => layer === 'missing' ? undefined : {}, queryRenderedFeatures: () => [feature(id), feature('point')] };
    expect(queryMapHit(service, { x: 0, y: 0 }, rules)).to.deep.equal({ status: 'invalid', reason: 'features' });
    expect(selectMapHit([feature(id), feature('point')], rules, ['point']).status).to.equal('hit');
  }
});

describe('map hit eligibility', () => {
  it('evaluates constant and zoom-driven interpolate/step opacity, and nothing else', () => {
    const fade = ['interpolate', ['linear'], ['zoom'], 6, 0, 8, 1];
    expect(zoomPaintValue(0.4, 3)).to.equal(0.4);
    expect(zoomPaintValue(fade, 5)).to.equal(0); expect(zoomPaintValue(fade, 7)).to.equal(0.5); expect(zoomPaintValue(fade, 9)).to.equal(1);
    expect(zoomPaintValue(['interpolate', ['exponential', 2], ['zoom'], 4, 1, 10, 0], 12)).to.equal(0);
    const steps = ['step', ['zoom'], 0, 5, 0.8, 9, 0];
    expect(zoomPaintValue(steps, 4)).to.equal(0); expect(zoomPaintValue(steps, 5)).to.equal(0.8); expect(zoomPaintValue(steps, 9.5)).to.equal(0);
    for (const unknown of [['get', 'opacity'], ['interpolate', ['linear'], ['get', 'v'], 0, 0, 1, 1], ['coalesce', ['feature-state', 'o'], 1],
      ['step', ['zoom'], ['get', 'x'], 6, 1], ['interpolate', ['linear'], ['zoom']], Number.NaN, '0', undefined]) {
      expect(zoomPaintValue(unknown, 5), JSON.stringify(unknown)).to.equal(undefined);
    }
  });

  it('skips layers outside their fractional zoom range, hidden, or transparent in every opacity', () => {
    const paint = new Map<string, unknown>(); const layout = new Map<string, unknown>();
    const reader = { getPaintProperty: (id: string, key: string) => paint.get(`${id}:${key}`), getLayoutProperty: (id: string, key: string) => layout.get(`${id}:${key}`) };
    const ranged = { id: 'tier', type: 'fill', minzoom: 10.5, maxzoom: 14 };
    expect(mapLayerHittable(reader, 'tier', ranged, 10.2)).to.equal(false);
    expect(mapLayerHittable(reader, 'tier', ranged, 10.5)).to.equal(true);
    expect(mapLayerHittable(reader, 'tier', ranged, 14)).to.equal(false);
    paint.set('tier:fill-opacity', ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1]);
    expect(mapLayerHittable(reader, 'tier', ranged, 10.8)).to.equal(false); expect(mapLayerHittable(reader, 'tier', ranged, 11.5)).to.equal(true);
    layout.set('tier:visibility', 'none'); expect(mapLayerHittable(reader, 'tier', ranged, 12)).to.equal(false);
    const symbol = { id: 'poi', type: 'symbol' };
    paint.set('poi:icon-opacity', 0); expect(mapLayerHittable(reader, 'poi', symbol, 5)).to.equal(true);
    paint.set('poi:text-opacity', 0); expect(mapLayerHittable(reader, 'poi', symbol, 5)).to.equal(false);
    paint.set('dyn:circle-opacity', ['get', 'o']);
    expect(mapLayerHittable(reader, 'dyn', { id: 'dyn', type: 'circle' }, 5)).to.equal(true);
    expect(mapLayerHittable({}, 'bare', { id: 'bare', type: 'line', minzoom: 2 }, 3)).to.equal(true);
    expect(mapLayerHittable(reader, 'tier', ranged, Number.NaN)).to.equal(true);
    const throwing = { getPaintProperty: () => { throw new Error('gone'); } };
    expect(mapLayerHittable(throwing, 'x', { id: 'x', type: 'fill' }, 3)).to.equal(true);
  });
});
