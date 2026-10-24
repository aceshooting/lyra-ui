import { expect } from '@open-wc/testing';
import { buildMapExternalLayers, projectMapDataLayerModel, projectMapLabelOptions, projectMapRowPlacement } from './map-data-layer-model.js';

const baseUrl = 'https://example.test/maps/';
const vector = { kind: 'vector', sourceId: 'places', sourceLayer: 'places', render: 'line', source: { tiles: ['./{z}/{x}/{y}.pbf'] } };
const project = (rows: unknown) => projectMapDataLayerModel(rows, {
  baseUrl, projectGeoJson: () => undefined,
});

describe('map external layer admission boundaries', () => {
  it('skips absent and accessor array entries without reading them or losing later valid rows', () => {
    let reads = 0;
    const rows: unknown[] = new Array(4);
    Object.defineProperty(rows, '1', { get() { reads += 1; return vector; } });
    rows[2] = null; rows[3] = vector;
    const model = project(rows);
    expect(reads).to.equal(0);
    expect(model.ok).to.equal(true);
    if (!model.ok) throw new Error('Expected the later data row to be admitted');
    expect(model.external.map(row => row.sourceId)).to.deep.equal(['places']);
    expect(model.geojson).to.deep.equal([]);
  });

  it('rejects malformed tile collections, schemes and identifiers as an entire external request', () => {
    const customTiles = Object.setPrototypeOf(['./tile.pbf'], Object.create(Array.prototype)) as unknown;
    for (const [name, change] of [
      ['non-array tiles', { source: { tiles: './tile.pbf' } }],
      ['custom array prototype', { source: { tiles: customTiles } }],
      ['empty tiles', { source: { tiles: [] } }],
      ['unknown scheme', { source: { tiles: ['./tile.pbf'], scheme: 'quad' } }],
      ['reserved identity', { sourceId: 'constructor' }],
      ['unknown render', { render: 'heatmap' }],
      ['raster vector render', { render: 'raster' }],
      ['unknown member', { unexpected: true }],
      ['expanded relative URL', { source: { url: 'a'.repeat(4090) } }],
    ] as const) {
      expect(project([vector, { ...vector, sourceId: 'other', ...change }]).ok, name).to.equal(false);
    }
    expect(project([vector]).ok).to.equal(true);
  });

  it('preserves explicit native tile scheme and zoom bounds while leaving omitted bounds absent', () => {
    for (const scheme of ['xyz', 'tms']) {
      const model = project([{ ...vector, source: { tiles: ['./{z}/{x}/{y}.pbf'], minZoom: 2, maxZoom: 17, scheme } }]);
      if (!model.ok) throw new Error('Expected explicit tile settings to be admitted');
      expect(model.external[0]!.source).to.deep.equal({ type: 'vector',
        tiles: ['https://example.test/maps/{z}/{x}/{y}.pbf'], minzoom: 2, maxzoom: 17, scheme });
    }
    const model = project([vector]);
    if (!model.ok) throw new Error('Expected default tile settings to be admitted');
    expect(Object.keys(model.external[0]!.source)).to.deep.equal(['type', 'tiles']);
    for (const value of [null, undefined, 3, 'row']) expect(projectMapRowPlacement(value)).to.equal(undefined);
  });

  it('rejects invalid label structure and flags before any native layer is constructed', () => {
    for (const label of [
      { expression: [] }, { expression: [4] }, { expression: { get: 'name' } },
      { field: 'name', font: [] }, { field: 'name', allowOverlap: 'true' },
      { field: 'name', ignorePlacement: 1 },
    ]) {
      expect(projectMapLabelOptions(label)).to.equal(undefined);
      expect(project([{ ...vector, label }]).ok).to.equal(false);
    }
    expect(project([{ ...vector, maxZoom: 4, label: { field: 'name', minZoom: 5 } }]).ok).to.equal(false);
    expect(project([{ ...vector, maxZoom: 5, label: { field: 'name', minZoom: 5 } }]).ok).to.equal(true);
  });

  it('applies feature category opacity to circle and fill paint without muting the whole layer', () => {
    const model = project(['circle', 'fill'].map(render => ({ ...vector, sourceId: render, render,
      category: 'visible', categoryField: 'kind', opacity: 0.8, color: 'blue', strokeColor: 'red', width: 3, radius: 7 })));
    if (!model.ok) throw new Error('Expected vector paint rows to be admitted');
    const built = buildMapExternalLayers(model.external, { nativeId: row => row.sourceId,
      color: value => value ?? 'black', glyphs: false, hidden: new Set(['quiet']), mutedOpacity: 0.25 });
    const alpha = ['case', ['in', ['to-string', ['get', 'kind']], ['literal', ['quiet']]], 0.2, 0.8];
    expect(built.layers.map(row => row.layer.type)).to.deep.equal(['circle', 'fill']);
    expect(built.layers[0]!.layer['paint']).to.deep.equal({ 'circle-color': 'blue', 'circle-radius': 7,
      'circle-stroke-color': 'red', 'circle-stroke-width': 3, 'circle-opacity': alpha, 'circle-stroke-opacity': alpha });
    expect(built.layers[1]!.layer['paint']).to.deep.equal({ 'fill-color': 'blue', 'fill-outline-color': 'red', 'fill-opacity': alpha });
  });

  it('builds labeled symbols with and without an icon and keeps text and icon category opacity paired', () => {
    for (const icon of [false, true]) {
      const model = project([{ ...vector, render: 'symbol', categoryField: 'kind', opacity: 0.8,
        label: { field: 'name', minZoom: 3 }, ...(icon ? { layout: { 'icon-image': 'place-icon' } } : {}) }]);
      if (!model.ok) throw new Error('Expected labeled symbol to be admitted');
      const built = buildMapExternalLayers(model.external, { nativeId: () => 'places',
        color: value => value ?? 'black', hidden: new Set(['quiet']), mutedOpacity: 0.25, glyphs: true });
      expect(built.layers.length).to.equal(1);
      const layer = built.layers[0]!.layer;
      const layout = layer['layout'] as Record<string, unknown>, paint = layer['paint'] as Record<string, unknown>;
      expect(layer).to.include({ type: 'symbol', minzoom: 3, 'source-layer': 'places' });
      expect(layout['text-field']).to.deep.equal(['get', 'name']);
      const alpha = ['case', ['in', ['to-string', ['get', 'kind']], ['literal', ['quiet']]], 0.2, 0.8];
      expect(paint['text-opacity']).to.deep.equal(alpha);
      expect(Object.hasOwn(layout, 'icon-size')).to.equal(icon);
      expect(Object.hasOwn(paint, 'icon-opacity')).to.equal(icon);
      if (icon) {
        expect(layout).to.include({ 'icon-image': 'place-icon', 'icon-size': 1, 'icon-allow-overlap': false, 'icon-ignore-placement': false });
        expect(paint['icon-opacity']).to.deep.equal(alpha);
      }
      expect(built.hits.get('places-render')).to.deep.equal({ sourceId: 'places', sourceLayer: 'places' });
    }
  });
});
