import { expect } from '@open-wc/testing';
import { admitMapOverlays, isIdentityGeoJsonData, type MapOwnedOverlaySnapshot } from './map-overlay-admission.js';

const geojson = { type: 'FeatureCollection', features: [] };
const withSource = (descriptor: unknown, id: unknown = 'src') => ({ sources: [{ id, source: descriptor }] });
const withLayer = (descriptor: unknown, row: Record<string, unknown> = {}) => ({ layers: [{ layer: descriptor, ...row }] });
const manyKeys = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`key${index}`, index]));

function rejection(input: unknown): string | undefined {
  const result = admitMapOverlays(input);
  return result.ok ? undefined : result.code;
}

function admitted(input: unknown): MapOwnedOverlaySnapshot {
  const result = admitMapOverlays(input);
  if (!result.ok) throw new Error(`Expected admission, received ${result.code}`);
  return result.overlays;
}

describe('map overlay admission boundaries', () => {
  it('accepts only plain roots that carry sources and layers', () => {
    const roots = [undefined, null, 'overlays', 7, [], new Date(), { sources: [], extra: true }, { layers: [], 7: 1 }];
    for (const [index, root] of roots.entries()) expect(rejection(root), `root ${index}`).to.equal('invalid-input');
    expect(admitted({}).sources.length).to.equal(0);
    expect(admitted(Object.create(null) as object).layers.length).to.equal(0);
  });

  it('requires trimmed, bounded identifiers and refuses the reserved prototype names', () => {
    for (const id of [5, null, '', '   ', 'x'.repeat(129), '__proto__', ' prototype ', 'constructor']) {
      expect(rejection(withSource({ type: 'geojson' }, id)), `source ${String(id)}`).to.equal('invalid-input');
      expect(rejection(withLayer({ id, type: 'fill' })), `layer ${String(id)}`).to.equal('invalid-input');
    }
    expect(rejection(withLayer({ id: 'fill', type: 'fill', source: '' }))).to.equal('invalid-input');
    expect(rejection(withLayer({ id: 'fill', type: 'fill' }, { before: 7 }))).to.equal('invalid-input');
    expect(admitted(withSource({ type: 'geojson' }, ` ${'x'.repeat(128)} `)).sources[0]!.id).to.equal('x'.repeat(128));
    expect(rejection({ sources: [{ id: 'one', source: { type: 'geojson' } }, { id: ' one ', source: { type: 'geojson' } }] })).to.equal('duplicate-id');
    expect(rejection({ layers: [{ layer: { id: 'one', type: 'fill' } }, { layer: { id: ' one ', type: 'line' } }] })).to.equal('duplicate-id');
  });

  it('requires lowercase type names and plain source and layer descriptors', () => {
    for (const type of [undefined, 5, '', 'Fill', '1fill', 'fill layer', `a${'b'.repeat(64)}`]) {
      expect(rejection(withSource({ type })), `source ${String(type)}`).to.equal('invalid-input');
      expect(rejection(withLayer({ id: 'fill', type })), `layer ${String(type)}`).to.equal('invalid-input');
    }
    for (const descriptor of [null, 'geojson', [], new Date(), 5]) {
      expect(rejection(withSource(descriptor)), `source ${typeof descriptor}`).to.equal('invalid-input');
    }
    for (const descriptor of [null, 'fill', [], 5]) {
      expect(rejection(withLayer(descriptor)), `layer ${typeof descriptor}`).to.equal('invalid-input');
    }
    expect(admitted({ sources: [{ id: 'dem', source: { type: 'raster-dem' } }] }).sources[0]!.source['type']).to.equal('raster-dem');
  });

  it('rejects malformed lists and rows, contains hostile arrays, and caps both list sizes', () => {
    const nullPrototype = Object.setPrototypeOf([], null) as unknown[];
    const revoked = Proxy.revocable<unknown[]>([], {});
    revoked.revoke();
    const unreadableLength = new Proxy<unknown[]>([], { getOwnPropertyDescriptor() { throw new Error('hostile length'); } });
    for (const [index, list] of [{}, 'rows', 7, nullPrototype, unreadableLength].entries()) {
      expect(rejection({ sources: list }), `sources ${index}`).to.equal('invalid-input');
      expect(rejection({ layers: list }), `layers ${index}`).to.equal('invalid-input');
    }
    expect(rejection({ sources: revoked.proxy })).to.equal('invalid-input');
    expect(rejection({ layers: revoked.proxy })).to.equal('invalid-input');
    expect(rejection({ sources: [null] })).to.equal('invalid-input');
    expect(rejection({ sources: [{ id: 'one', source: { type: 'geojson' }, extra: true }] })).to.equal('invalid-input');
    expect(rejection({ layers: [null] })).to.equal('invalid-input');
    expect(rejection({ layers: [{ layer: { id: 'one', type: 'fill' }, extra: true }] })).to.equal('invalid-input');
    const rows = (count: number) => Array.from({ length: count }, (_, index) => index);
    expect(rejection({ sources: rows(129).map(index => ({ id: `s${index}`, source: { type: 'geojson' } })) })).to.equal('limit');
    expect(rejection({ layers: rows(129).map(index => ({ layer: { id: `l${index}`, type: 'fill' } })) })).to.equal('limit');
    expect(admitted({ sources: rows(128).map(index => ({ id: `s${index}`, source: { type: 'geojson' } })) }).sources.length).to.equal(128);
  });

  it('keeps layer anchors, interaction options and a canvas handle in admitted rows', () => {
    const canvas = document.createElement('canvas');
    const overlays = admitted({
      sources: [{ id: ' pixels ', source: { type: 'canvas', canvas, coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] } }],
      layers: [{ layer: { id: ' fill ', type: 'fill', source: ' pixels ' }, before: ' labels ', interactive: true, priority: 3 }],
    });
    expect(overlays.sources[0]!.source['canvas'] === canvas).to.equal(true);
    expect(overlays.layers[0]).to.deep.equal({ interactive: true, priority: 3, layer: { id: 'fill', type: 'fill', source: 'pixels' }, before: 'labels' });
    expect(Object.isFrozen(overlays.layers[0]) && Object.isFrozen(overlays.layers[0]!.layer)).to.equal(true);
    expect(rejection(withSource({ type: 'canvas', coordinates: [] }))).to.equal('invalid-input');
    expect(rejection(withSource({ type: 'canvas', canvas: {} }))).to.equal('invalid-input');
  });

  for (const [type, payload] of [['canvas', { canvas: document.createElement('canvas') }], ['geojson', { data: geojson }]] as const) {
    it(`bounds ${type} descriptor entries, reserved keys and key text`, () => {
      const make = (extra: object) => withSource({ type, ...payload, ...extra });
      expect(rejection(make(manyKeys(10_000)))).to.equal('limit');
      expect(rejection(make({ constructor: 1 }))).to.equal('invalid-input');
      expect(rejection(make({ prototype: 1 }))).to.equal('invalid-input');
      expect(rejection(make(Object.defineProperty({}, '__proto__', { value: 1, enumerable: true })))).to.equal('invalid-input');
      expect(rejection(make({ ['k'.repeat(1_048_577)]: 1 }))).to.equal('limit');
      expect(rejection(make(manyKeys(9_000)))).to.equal(undefined);
    });
  }

  it('retains a GeoJSON envelope by identity while snapshotting the rest of the descriptor', () => {
    const overlays = admitted(withSource({ type: 'geojson', data: geojson, cluster: true, clusterRadius: 40 }));
    expect(overlays.sources[0]!.source['data'] === geojson).to.equal(true);
    expect(overlays.sources[0]!.source['clusterRadius']).to.equal(40);
    expect(isIdentityGeoJsonData(geojson)).to.equal(true);
    expect(isIdentityGeoJsonData({ ...geojson })).to.equal(false);
  });

  it('refuses a canvas descriptor where canvas elements do not exist', () => {
    const canvas = document.createElement('canvas');
    const descriptor = withSource({ type: 'canvas', canvas, coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] });
    expect(rejection(descriptor)).to.equal(undefined);
    const saved = Object.getOwnPropertyDescriptor(window, 'HTMLCanvasElement')!;
    Object.defineProperty(window, 'HTMLCanvasElement', { configurable: true, writable: true, value: undefined });
    try { expect(rejection(descriptor)).to.equal('invalid-input'); }
    finally { Object.defineProperty(window, 'HTMLCanvasElement', saved); }
    expect(rejection(descriptor)).to.equal(undefined);
  });
});
