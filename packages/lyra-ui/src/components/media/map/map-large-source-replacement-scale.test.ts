import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect } from '@open-wc/testing';
import './map.js';
import { projectAdmittedGeoJson } from './map-geojson-diff.js';

for (const count of [1, 1_000_000]) {
  it(`replaces distinct non-comparable GeoJSON sources with ${count} features`, () => {
    const feature = (x: number) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, 0] }, properties: {} });
    const payload = (x: number) => count === 1 ? feature(x) : { type: 'FeatureCollection', features: new Array(count).fill(feature(x)) };
    const first = payload(0); const next = payload(1);
    const el = document.createElement('lr-map');
    const seam = el as unknown as { pushGeoJson(source: unknown, id: string, data: unknown, projection: unknown): void };
    let current: unknown; let writes = 0;
    const source = { setData(data: unknown) { current = data; writes++; } };
    seam.pushGeoJson(source, 'points', first, projectAdmittedGeoJson(first));
    seam.pushGeoJson(source, 'points', next, projectAdmittedGeoJson(next));
    expect(current === next).to.equal(true);
    expect(writes).to.equal(2);
    recordScaleMeasurement('lr-map', `n=${count} non-comparable source replacement`, { writes });
    seam.pushGeoJson(source, 'points', next, projectAdmittedGeoJson(next));
    expect(writes).to.equal(2);
  });
}

it('reconciles explicit mutable-source refresh once even when coalesced with a named update', async () => {
  const el = document.createElement('lr-map');
  el.engine = 'maplibre';
  (el as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = () => new Promise(() => {});
  document.body.append(el); await el.updateComplete;
  let writes = 0; let currentX = -1;
  const sources = new Map<string, { setData(data: unknown): void }>(); const layers = new Set<string>();
  const feature = { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [0, 0] }, properties: {} };
  const seam = el as unknown as { _map: unknown; _styleLoaded: boolean; applyDataLayers(): void; reconcileGeneratedLayers(): void };
  const apply = (data: unknown) => { writes++; currentX = (data as typeof feature).geometry.coordinates[0]!; };
  seam._map = {
    getSource: (id: string) => sources.get(id),
    addSource(id: string, spec: { data: unknown }) { apply(spec.data); sources.set(id, { setData: apply }); },
    getLayer: (id: string) => layers.has(id), addLayer(layer: { id: string }) { layers.add(layer.id); },
    setPaintProperty() {}, remove() {},
  };
  seam._styleLoaded = true;
  seam.reconcileGeneratedLayers = () => seam.applyDataLayers();
  try {
    el.dataLayers = [{ sourceId: 'points', geojson: feature }]; await el.updateComplete;
    expect(currentX).to.equal(0);
    const before = writes;
    feature.geometry.coordinates[0] = 7;
    el.requestUpdate(); el.label = 'Updated map'; await el.updateComplete;
    expect(currentX).to.equal(7);
    expect(writes - before).to.equal(1);
    seam.applyDataLayers(); expect(writes - before).to.equal(1);
  } finally { el.remove(); }
});

for (const field of ['geometry', 'bbox'] as const) {
  it(`replaces explicitly refreshed ${field} with an incremental-capable peer`, async () => {
    const el = document.createElement('lr-map'); el.engine = 'maplibre';
    (el as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = () => new Promise(() => {});
    document.body.append(el); await el.updateComplete;
    const feature = { type: 'Feature' as const, id: 1, geometry: { type: 'Point' as const, coordinates: [0, 0] }, bbox: [-1, -1, 1, 1] as [number, number, number, number], properties: { value: 1 } };
    const collection = { type: 'FeatureCollection' as const, features: [feature] };
    let writes = 0; let diffs = 0; let current = -1;
    const sources = new Map<string, { setData(data: unknown): void; updateData(): void }>(); const layers = new Set<string>();
    const apply = (data: unknown) => {
      writes++;
      const point = (data as typeof collection).features[0]!;
      current = field === 'geometry' ? point.geometry.coordinates[0]! : point.bbox[2]!;
    };
    const seam = el as unknown as { _map: unknown; _styleLoaded: boolean; applyDataLayers(): void; reconcileGeneratedLayers(): void };
    seam._map = {
      getSource: (id: string) => sources.get(id),
      addSource(id: string, spec: { data: unknown }) { apply(spec.data); sources.set(id, { setData: apply, updateData() { diffs++; } }); },
      getLayer: (id: string) => layers.has(id), addLayer(layer: { id: string }) { layers.add(layer.id); },
      setPaintProperty() {}, remove() {},
    };
    seam._styleLoaded = true; seam.reconcileGeneratedLayers = () => seam.applyDataLayers();
    try {
      el.dataLayers = [{ sourceId: 'points', geojson: collection }]; await el.updateComplete;
      expect(writes).to.equal(1);
      if (field === 'geometry') feature.geometry.coordinates[0] = 7;
      else feature.bbox[2] = 7;
      el.requestUpdate(); el.label = 'Refreshed geometry'; await el.updateComplete;
      expect(current).to.equal(7);
      expect(writes).to.equal(2); expect(diffs).to.equal(0);
      el.dataLayers = [{ sourceId: 'points', geojson: collection }]; await el.updateComplete;
      el.requestUpdate(); await el.updateComplete;
      expect(writes).to.equal(2); expect(diffs).to.equal(0);
      feature.properties.value = 2;
      el.requestUpdate(); await el.updateComplete;
      expect(writes).to.equal(2); expect(diffs).to.equal(1);
    } finally { el.remove(); }
  });
}
