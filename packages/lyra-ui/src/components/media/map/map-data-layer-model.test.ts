import { expect } from '@open-wc/testing';
import { buildMapExternalLayers, buildMapLabelLayer, projectMapDataLayerModel, projectMapLabelOptions } from './map-data-layer-model.js';

const baseUrl = 'https://example.test/maps/';
const coordinates = [[-10, 10], [10, 10], [10, -10], [-10, -10]];
const legacy = (value: unknown): { sourceId: string } | undefined => {
  const row = value as { sourceId?: string; geojson?: unknown };
  return row?.geojson && typeof row.sourceId === 'string' ? { sourceId: row.sourceId } : undefined;
};
const project = (rows: unknown) => projectMapDataLayerModel(rows, { baseUrl, projectGeoJson: legacy });
const vector = { kind: 'vector', sourceId: 'roads', sourceLayer: 'transportation', render: 'line', source: { tiles: ['../tiles/{z}/{x}/{y}.pbf'] } };

describe('map data layer model', () => {
  it('keeps legacy rows and the first admitted identity across source families', () => {
    const result = project([{ sourceId: 'old' }, { sourceId: 'old', geojson: {} }, vector, { ...vector, sourceId: 'old' }]);
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.geojson.map(row => row.sourceId)).to.deep.equal(['old']);
    expect(result.external.map(row => row.sourceId)).to.deep.equal(['roads']);
    expect(result.external[0]!.source['tiles']).to.deep.equal(['https://example.test/tiles/{z}/{x}/{y}.pbf']);
  });
  it('keeps the legacy first 100 input-row ceiling and unset no-op', () => {
    expect(project(undefined)).to.deep.equal({ ok: true, geojson: [], external: [] });
    const result = project([...Array.from({ length: 100 }, () => ({})), vector]);
    expect(result.ok && result.external.length).to.equal(0);
  });
  it('rejects requested invalid external records without invoking accessors', () => {
    let calls = 0;
    const row = { ...vector, source: { get tiles() { calls += 1; return []; } } };
    expect(project([row]).ok).to.equal(false);
    expect(calls).to.equal(0);
    expect(project([{ ...vector, source: Object.create({ tiles: ['https://example.test/a'] }) }]).ok).to.equal(false);
  });
  it('rejects credentialed, unsafe, unknown-template and oversized URLs', () => {
    for (const url of ['data:text/plain,a', 'blob:https://example.test/x', 'javascript:alert(1)', 'https://a:b@example.test/a', 'https://example.test/{unknown}', 'https://LYRATILEPLACEHOLDER0TOKEN.example/{z}/{x}/{y}', 'https://%6cyratileplaceholder0token.example/{z}', 'x'.repeat(4097)]) {
      expect(project([{ ...vector, source: { tiles: [url] } }]).ok, url.slice(0, 40)).to.equal(false);
    }
    expect(project([{ ...vector, source: { tiles: ['https://example.test/a'], url: 'https://example.test/b' } }]).ok).to.equal(false);
  });
  it('rejects sparse tiles, nonfinite paint and reversed zoom ranges', () => {
    expect(project([{ ...vector, source: { tiles: new Array(1) } }]).ok).to.equal(false);
    expect(project([{ ...vector, width: Infinity }]).ok).to.equal(false);
    expect(project([{ ...vector, minZoom: 12, maxZoom: 3 }]).ok).to.equal(false);
    expect(project([{ ...vector, minZoom: 30, maxZoom: 25 }]).ok).to.equal(false);
    expect(project([{ ...vector, source: { tiles: ['./tile'], minZoom: -1, maxZoom: -2 } }]).ok).to.equal(false);
    expect(project([{ ...vector, source: { tiles: Array.from({ length: 17 }, () => 'https://example.test/a') } }]).ok).to.equal(false);
  });
  it('escapes attribution as text and clamps finite dimensions', () => {
    const result = project([{ ...vector, width: 999, source: { tiles: ['https://example.test/a'], attribution: '<img src=x onerror=x>' } }]);
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.external[0]!.width).to.equal(100);
    expect(result.external[0]!.source['attribution']).to.equal('&lt;img src=x onerror=x&gt;');
  });
  it('accepts each coordinate source with a frozen snapshot and real canvas identity', () => {
    const canvas = document.createElement('canvas');
    const result = project([{ kind: 'image', sourceId: 'image', url: './a.png', coordinates }, { kind: 'canvas', sourceId: 'canvas', canvas, coordinates }]);
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.external[0]!.source['url']).to.equal('https://example.test/maps/a.png');
    expect(result.external[1]!.source['canvas'] === canvas).to.equal(true);
    expect(result.external[1]!.source['animate']).to.equal(true);
    expect(Object.isFrozen(result.external[0]!.source['coordinates'])).to.equal(true);
    expect(project([{ kind: 'canvas', sourceId: 'bad', canvas: {}, coordinates }]).ok).to.equal(false);
  });
  it('rejects invalid coordinate shapes and geographic ranges', () => {
    for (const corners of [coordinates.slice(0, 3), [[181, 0], ...coordinates.slice(1)], [[0, NaN], ...coordinates.slice(1)], new Array(4)]) {
      expect(project([{ kind: 'image', sourceId: 'image', url: './a.png', coordinates: corners }]).ok).to.equal(false);
    }
  });
  it('limits external source count without silently truncating a request', () => {
    expect(project(Array.from({ length: 33 }, (_, index) => ({ ...vector, sourceId: String(index) }))).ok).to.equal(false);
  });
  it('projects actual vector source-layer, zoom, native order and category opacity', () => {
    const model = project([{ ...vector, before: 'labels', category: 'roads', minZoom: 2, maxZoom: 18 }]);
    if (!model.ok) throw new Error('Expected admitted model');
    const result = buildMapExternalLayers(model.external, { nativeId: () => 'private', color: value => value ?? '#000', hidden: new Set(['roads']), glyphs: true });
    expect(result.sources[0]!.source['type']).to.equal('vector');
    expect(result.layers[0]!.before).to.equal('labels');
    expect(result.layers[0]!.layer).to.include({ source: 'private', 'source-layer': 'transportation', minzoom: 2, maxzoom: 18 });
    expect((result.layers[0]!.layer['paint'] as Record<string, unknown>)['line-opacity']).to.equal(0.15);
    expect(result.hits.get('private-render')).to.deep.equal({ sourceId: 'roads', sourceLayer: 'transportation' });
  });
  it('preserves tiled raster paint and pairs finite image corners with an anonymous query footprint', () => {
    const model = project([{ kind: 'raster', sourceId: 'raster', source: { tiles: ['./{z}/{x}/{y}.png'], tileSize: 512 } }, { kind: 'image', sourceId: 'image', url: './a.png', coordinates }]);
    if (!model.ok) throw new Error('Expected admitted model');
    const result = buildMapExternalLayers(model.external, { nativeId: row => row.sourceId, color: value => value ?? '#000', hidden: new Set(), glyphs: false });
    expect(result.layers.map(row => row.layer.type)).to.deep.equal(['raster', 'raster', 'fill']);
    expect(result.layers[0]!.layer['paint']).to.deep.equal({ 'raster-opacity': 1 });
    expect(result.hits.get('image-hit')).to.deep.equal({ sourceId: 'image' });
    expect(result.hits.has('raster-render')).to.equal(false);
    expect(result.sources.map(row => row.id)).to.deep.equal(['raster', 'image', 'image-hit-source']);
    expect(result.sources[2]!.source).to.deep.equal({ type: 'geojson', data: {
      type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] },
    } });
    expect(result.layers[2]!.layer).to.include({ id: 'image-hit', type: 'fill', source: 'image-hit-source' });
    expect(result.layers[2]!.layer['paint']).to.deep.equal({ 'fill-opacity': 0, 'fill-antialias': false });
  });
  it('gives canvas the same detached footprint without inventing feature identity or source-layer', () => {
    const element = document.createElement('canvas');
    const model = project([{ kind: 'canvas', sourceId: 'paint', canvas: element, coordinates }]);
    if (!model.ok) throw new Error('Expected admitted model');
    const result = buildMapExternalLayers(model.external, { nativeId: () => 'native', color: value => value ?? '#000', hidden: new Set(), glyphs: false });
    expect(result.layers.map(row => row.layer.id)).to.deep.equal(['native-render', 'native-hit']);
    expect(result.hits.get('native-hit')).to.deep.equal({ sourceId: 'paint' });
    expect(Object.hasOwn(result.hits.get('native-hit')!, 'sourceLayer')).to.equal(false);
    expect(Object.hasOwn(result.layers[1]!.layer, 'source-layer')).to.equal(false);
    const feature = result.sources[1]!.source['data'] as Record<string, unknown>;
    expect(Object.hasOwn(feature, 'id')).to.equal(false); expect(feature['properties']).to.deep.equal({});
    expect(result.sources[0]!.source['canvas'] === element).to.equal(true);
  });
  it('keeps proxy insertion order, zoom admission and native before target paired at the full external cap', () => {
    const element = document.createElement('canvas');
    const model = project(Array.from({ length: 32 }, (_, index) => ({ sourceId: `footprint${index}`, coordinates,
      ...(index % 2 ? { kind: 'canvas', canvas: element } : { kind: 'image', url: './a.png' }), before: 'labels', minZoom: 2, maxZoom: 18 })));
    if (!model.ok) throw new Error('Expected admitted model');
    const result = buildMapExternalLayers(model.external, { nativeId: row => row.sourceId, color: value => value ?? '#000', hidden: new Set(), glyphs: false });
    expect(result.sources.length).to.equal(64); expect(result.layers.length).to.equal(64); expect(result.hits.size).to.equal(32);
    for (let index = 0; index < 32; index++) {
      const id = `footprint${index}`, render = result.layers[index * 2]!, proxy = result.layers[index * 2 + 1]!;
      expect([render.layer.id, proxy.layer.id]).to.deep.equal([`${id}-render`, `${id}-hit`]);
      expect([render.before, proxy.before]).to.deep.equal(['labels', 'labels']);
      expect(proxy.layer).to.include({ minzoom: 2, maxzoom: 18 });
      expect(result.sources[index * 2 + 1]!.id).to.equal(`${id}-hit-source`);
    }
  });
  it('omits disabled image/canvas proxies while leaving their native raster rendering intact', () => {
    const model = project([{ kind: 'image', sourceId: 'image', url: './a.png', coordinates, interactive: false },
      { kind: 'canvas', sourceId: 'canvas', canvas: document.createElement('canvas'), coordinates, interactive: false }]);
    if (!model.ok) throw new Error('Expected admitted model');
    const result = buildMapExternalLayers(model.external, { nativeId: row => row.sourceId, color: value => value ?? '#000', hidden: new Set(), glyphs: false });
    expect(result.sources.length).to.equal(2); expect(result.layers.map(row => row.layer.id)).to.deep.equal(['image-render', 'canvas-render']); expect(result.hits.size).to.equal(0);
  });
  it('clones closed footprint coordinates independently of caller input, admitted source and earlier builds', () => {
    const input = coordinates.map(point => [...point]);
    const make = () => project([{ kind: 'image', sourceId: 'image', url: './a.png', coordinates: input }]);
    const first = make(); if (!first.ok) throw new Error('Expected admitted model');
    const context = { nativeId: () => 'native', color: (value: string | undefined) => value ?? '#000', hidden: new Set<string>(), glyphs: false };
    const built = buildMapExternalLayers(first.external, context);
    const ring = (built.sources[1]!.source['data'] as { geometry: { coordinates: readonly (readonly (readonly number[])[])[] } }).geometry.coordinates[0]!;
    input[0]![0] = -20;
    expect(ring[0]).to.deep.equal([-10, 10]); expect(ring[4]).to.deep.equal([-10, 10]);
    expect(ring[0] === ring[4]).to.equal(false); expect(ring[0] === (first.external[0]!.source['coordinates'] as readonly unknown[])[0]).to.equal(false);
    expect(Object.isFrozen(ring) && ring.every(Object.isFrozen)).to.equal(true);
    const updated = make(); if (!updated.ok) throw new Error('Expected admitted update');
    const next = buildMapExternalLayers(updated.external, context), replay = buildMapExternalLayers(updated.external, context);
    expect(next.sources.map(row => row.id)).to.deep.equal(built.sources.map(row => row.id));
    expect(next.layers.map(row => row.layer.id)).to.deep.equal(built.layers.map(row => row.layer.id));
    expect(next.sources[1]!.source).to.deep.equal(replay.sources[1]!.source);
    expect((next.sources[1]!.source['data'] as { geometry: { coordinates: unknown } }).geometry.coordinates).to.deep.equal([[...input, input[0]]]);
    expect(ring[0]).to.deep.equal([-10, 10]);
  });

});

describe('map labels', () => {
  it('preserves bounded localized expressions and caps halo to a quarter of size', () => {
    const expression = ['coalesce', ['get', 'name:fr'], ['get', 'name']];
    const label = projectMapLabelOptions({ expression, size: 16, haloWidth: 90, font: ['Open Sans Regular'], placement: 'line' });
    expect(label?.haloWidth).to.equal(4);
    expect(label?.expression).to.deep.equal(expression);
    expect(Object.isFrozen(label?.expression)).to.equal(true);
    const layer = buildMapLabelLayer('labels', 'roads', label!, value => value ?? '#000');
    expect(layer['layout']).to.include({ 'symbol-placement': 'line', 'text-size': 16, 'text-allow-overlap': false });
  });
  it('rejects ambiguous, cyclic, accessor and unbounded expressions', () => {
    const cycle: unknown[] = ['literal']; cycle.push(cycle);
    expect(projectMapLabelOptions({ field: 'name', expression: ['get', 'name'] })).to.equal(undefined);
    expect(projectMapLabelOptions({ expression: cycle })).to.equal(undefined);
    expect(projectMapLabelOptions({ expression: ['literal', 'x'.repeat(65_537)] })).to.equal(undefined);
    expect(projectMapLabelOptions({ field: 'name', size: NaN })).to.equal(undefined);
    expect(projectMapLabelOptions({ field: 'name', placement: null })).to.equal(undefined);
    expect(projectMapLabelOptions({ expression: ['literal', { ['x'.repeat(65_537)]: true }] })).to.equal(undefined);
    let calls = 0;
    expect(projectMapLabelOptions({ get field() { calls += 1; return 'name'; } })).to.equal(undefined);
    expect(calls).to.equal(0);
  });
  it('rejects oversized expression text before allocating an encoded copy', () => {
    const original = TextEncoder.prototype.encode; let largest = 0;
    TextEncoder.prototype.encode = function (input?: string): Uint8Array<ArrayBuffer> {
      largest = Math.max(largest, input?.length ?? 0);
      return original.call(this, input);
    };
    try {
      expect(projectMapLabelOptions({ expression: ['literal', 'x'.repeat(65_537)] })).to.equal(undefined);
      expect(projectMapLabelOptions({ expression: ['literal', { ['x'.repeat(65_537)]: true }] })).to.equal(undefined);
      expect(largest).to.be.lessThan(65_537);
    } finally { TextEncoder.prototype.encode = original; }
  });

  it('fails explicitly when requested vector text has no glyph provider', () => {
    const model = project([{ ...vector, render: 'symbol', label: { field: 'name' } }]);
    if (!model.ok) throw new Error('Expected admitted model');
    expect(() => buildMapExternalLayers(model.external, { nativeId: () => 'private', color: value => value ?? '#000', hidden: new Set(), glyphs: false })).to.throw('Map labels require a glyph provider.');
  });
});

it('reuses the admitted kind descriptor for legacy and external rows', () => {
  let legacyReads = 0, externalReads = 0;
  const legacy = new Proxy({ sourceId: 'legacy', kind: 'heatmap' }, {
    getOwnPropertyDescriptor(target, key) { if (key === 'kind') legacyReads++; return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  const external = new Proxy({ kind: 'vector', sourceId: 'tiles', source: { tiles: ['https://example.test/{z}/{x}/{y}.pbf'] }, sourceLayer: 'roads', render: 'line' }, {
    getOwnPropertyDescriptor(target, key) { if (key === 'kind' && ++externalReads > 1) throw new Error('Kind was inspected twice'); return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  const result = projectMapDataLayerModel([legacy, external], { baseUrl: 'https://example.test/', projectGeoJson: (_row, descriptor) => {
    if (typeof descriptor === 'symbol') throw new Error('Expected data descriptor');
    expect(descriptor.value).to.equal('heatmap'); return { sourceId: 'legacy' };
  } });
  expect(result.ok).to.equal(true); expect(legacyReads).to.equal(1); expect(externalReads).to.equal(1);
  if (result.ok) { expect(result.geojson.length).to.equal(1); expect(result.external.length).to.equal(1); }
});
