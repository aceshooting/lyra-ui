import { expect, waitUntil } from '@open-wc/testing';
import {
  admitMapOverlays, MapOwnedResources, type MapOwnedOverlaySnapshot, type MapOwnedResourcePeer, type MapOwnedSourceChange,
} from './map-owned-resources.js';
import type { PreparedMapImage } from './map-images.js';
import { planMapSourceUpdate } from './map-source-updates.js';

function admission(input: unknown): MapOwnedOverlaySnapshot {
  const result = admitMapOverlays(input);
  if (!result.ok) throw new Error(`Unexpected admission failure: ${result.code}`);
  return result.overlays;
}
const empty = () => admission({});
const overlay = (source = 'points', layer = 'dots', extra: Record<string, unknown> = {}) => admission({
  sources: [{ id: source, source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }],
  layers: [{ layer: { id: layer, type: 'circle', source }, ...extra }],
});
function prepared(id: string) {
  let pixels: ImageData | null = new ImageData(1, 1);
  let disposals = 0;
  const resource: PreparedMapImage = {
    id, width: 1, height: 1, pixelRatio: 1,
    get image() { return pixels; },
    dispose() { if (pixels) { pixels = null; disposals += 1; } },
  };
  return { resource, get disposals() { return disposals; } };
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class ResourcePeer implements MapOwnedResourcePeer {
  readonly sources = new Map<string, unknown>();
  readonly layers = new Map<string, Readonly<Record<string, unknown>>>();
  readonly images = new Map<string, ImageData>();
  readonly operations: string[] = [];
  order: string[] = [];
  reject?: string;
  after?: (operation: string) => void;
  planSourceUpdate?: MapOwnedResourcePeer['planSourceUpdate'];
  getSource(id: string): unknown { return this.sources.get(id); }
  getLayer(id: string): unknown { return this.layers.get(id); }
  layerIds(): readonly string[] { return [...this.order]; }
  hasImage(id: string): boolean { return this.images.has(id); }
  private call(operation: string): void {
    this.operations.push(operation); this.after?.(operation);
    if (this.reject === operation) { this.reject = undefined; throw new Error('private peer payload'); }
  }
  addImage(id: string, image: ImageData): void {
    if (this.images.has(id)) throw new Error('image collision');
    this.images.set(id, image); this.call(`image+${id}`);
  }
  removeImage(id: string): void { this.images.delete(id); this.call(`image-${id}`); }
  addSource(id: string, source: unknown): void {
    if (this.sources.has(id)) throw new Error('source collision');
    this.sources.set(id, source); this.call(`source+${id}`);
  }
  removeSource(id: string): void {
    if ([...this.layers.values()].some(layer => layer['source'] === id)) throw new Error('source still in use');
    this.sources.delete(id); this.call(`source-${id}`);
  }
  addLayer(layer: Readonly<Record<string, unknown>>, before?: string): void {
    const id = layer['id'] as string;
    if (this.layers.has(id)) throw new Error('layer collision');
    if (typeof layer['source'] === 'string' && !this.sources.has(layer['source'])) throw new Error('missing source');
    this.layers.set(id, layer);
    this.order.splice(before === undefined ? this.order.length : this.order.indexOf(before), 0, id);
    this.call(`layer+${id}`);
  }
  removeLayer(id: string): void {
    this.layers.delete(id); this.order = this.order.filter(value => value !== id); this.call(`layer-${id}`);
  }
  moveLayer(id: string, before?: string): void {
    this.order = this.order.filter(value => value !== id);
    this.order.splice(before === undefined ? this.order.length : this.order.indexOf(before), 0, id);
    this.call(`move:${id}`);
  }
}
const current = () => true;
const context = () => ({ isCurrent: current, prepare: async () => undefined });

describe('owned map overlay admission', () => {
  it('detaches and freezes plain data while preserving an explicit canvas handle', () => {
    const canvas = document.createElement('canvas');
    const input = { sources: [{ id: ' raster ', source: { type: 'canvas', canvas, animate: true,
      coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] } }],
      layers: [{ layer: { id: ' coverage ', source: ' raster ', type: 'raster', paint: { 'raster-opacity': 0.5 } } }] };
    const result = admission(input);
    input.sources[0]!.source.coordinates[0]![0] = 10;
    expect(result.sources[0]!.id).to.equal('raster');
    expect(result.sources[0]!.source['canvas'] === canvas).to.equal(true);
    expect((result.sources[0]!.source['coordinates'] as number[][])[0]![0]).to.equal(0);
    expect(result.layers[0]!.layer['id']).to.equal('coverage');
    expect(result.layers[0]!.layer['source']).to.equal('raster');
    expect(Object.isFrozen(result.sources[0]!.source)).to.equal(true);
  });

  it('rejects duplicate IDs, accessors, sparse values, hostile prototypes and finite-work limits atomically', () => {
    let reads = 0;
    const source = { type: 'geojson', get data() { reads += 1; return {}; } };
    expect(admitMapOverlays({ sources: [{ id: 'x', source }] }).ok).to.equal(false);
    expect(reads).to.equal(0);
    expect(admitMapOverlays({ sources: [{ id: 'x', source: { type: 'geojson' } }, { id: ' x ', source: { type: 'geojson' } }] }).ok).to.equal(false);
    expect(admitMapOverlays({ layers: [{ layer: { id: 'x', type: 'line', paint: [ , 1 ] } }] }).ok).to.equal(false);
    expect(admitMapOverlays({ sources: [{ id: 'x', source: new Date() }] }).ok).to.equal(false);
    expect(admitMapOverlays({ sources: Array.from({ length: 129 }, (_, i) => ({ id: String(i), source: { type: 'geojson' } })) }).ok).to.equal(false);
    expect(admitMapOverlays({ layers: [{ layer: { id: 'x', type: 'circle', paint: { radius: Infinity } } }] }).ok).to.equal(false);
    const cycle: Record<string, unknown> = {}; cycle['self'] = cycle;
    expect(admitMapOverlays({ sources: [{ id: 'x', source: { type: 'geojson', data: cycle } }] }).ok).to.equal(false);
  });

  it('preserves required source type when it is a non-enumerable own data field', () => {
    const source = Object.defineProperty({}, 'type', { value: 'geojson' });
    const result = admission({ sources: [{ id: 'points', source }] });
    expect(result.sources[0]!.source['type']).to.equal('geojson');
  });

  it('retains GeoJSON envelopes by identity outside the value budget and snapshots the rest', () => {
    const features = Array.from({ length: 30_000 }, (_, index) => ({ type: 'Feature', id: index, properties: { v: index },
      geometry: { type: 'Point', coordinates: [index % 180, 0] } }));
    const data = { type: 'FeatureCollection', features };
    const input = { sources: [{ id: 'big', source: { type: 'geojson', data, promoteId: 'v', cluster: false } }] };
    const result = admission(input);
    expect(result.sources[0]!.source['data'] === data).to.equal(true);
    expect(result.sources[0]!.source['promoteId']).to.equal('v');
    expect(Object.isFrozen(result.sources[0]!.source)).to.equal(true); expect(Object.isFrozen(data)).to.equal(false);
    const feature = { type: 'Feature', geometry: null, properties: {} };
    expect(admission({ sources: [{ id: 'one', source: { type: 'geojson', data: feature } }] }).sources[0]!.source['data'] === feature).to.equal(true);
    // Anything else under data keeps the bounded copy, and non-geojson sources never retain identity.
    expect(admitMapOverlays({ sources: [{ id: 'x', source: { type: 'vector', data } }] }).ok).to.equal(false);
    let reads = 0;
    const hostile = { type: 'FeatureCollection', get features() { reads += 1; return []; } };
    expect(admitMapOverlays({ sources: [{ id: 'x', source: { type: 'geojson', data: hostile } }] }).ok).to.equal(false);
    expect(reads).to.equal(0);
  });

  it('updates identity GeoJSON in place by reference and replaces it for metadata changes', () => {
    const calls: unknown[] = [];
    const source = { setData(value: unknown) { calls.push(value); } };
    const first = { type: 'FeatureCollection', features: [] }, second = { type: 'FeatureCollection', features: [] };
    const before = admission({ sources: [{ id: 's', source: { type: 'geojson', data: first } }] }).sources[0]!.source;
    const after = admission({ sources: [{ id: 's', source: { type: 'geojson', data: second } }] }).sources[0]!.source;
    const plan = planMapSourceUpdate(source, before, after);
    expect(typeof plan).to.equal('function'); plan!(); expect(calls.length).to.equal(1); expect(calls[0] === second).to.equal(true);
    expect(planMapSourceUpdate(source, before, before)).to.equal(undefined);
    const promoted = admission({ sources: [{ id: 's', source: { type: 'geojson', data: second, promoteId: 'id' } }] }).sources[0]!.source;
    expect(planMapSourceUpdate(source, before, promoted)).to.equal(undefined);
  });

  it('does not retain arbitrary DOM handles or invoke a canvas-shaped accessor', () => {
    let reads = 0;
    const fake = { get ownerDocument() { reads += 1; return document; } };
    expect(admitMapOverlays({ sources: [{ id: 'x', source: { type: 'canvas', canvas: fake } }] }).ok).to.equal(false);
    expect(reads).to.equal(0);
    expect(admitMapOverlays({ sources: [{ id: 'x', source: { type: 'geojson', data: document.body } }] }).ok).to.equal(false);
  });
});

describe('owned map resource reconciliation', () => {
  const imageOverlay = (url = 'https://example.test/a.png') => admission({
    sources: [{ id: 'coverage', source: { type: 'image', url, coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] } }],
    layers: [{ layer: { id: 'coverage-layer', type: 'raster', source: 'coverage' } }],
  });

  it('announces admitted replacements and removal before retiring any dependent layer', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources(); const before = imageOverlay(), next = imageOverlay('https://example.test/b.png');
    await registry.reconcile(peer, 1, before, [], context()); peer.operations.length = 0;
    const changes: MapOwnedSourceChange[] = [];
    const beforeSourceChange = (change: MapOwnedSourceChange) => {
      changes.push(change); expect(peer.operations.length).to.equal(0); expect(Object.isFrozen(change)).to.equal(true);
    };
    expect((await registry.reconcile(peer, 1, next, [], { ...context(), beforeSourceChange })).ok).to.equal(true);
    expect(changes.map(change => change.reason)).to.deep.equal(['replace']);
    expect(changes[0]!.previous === before.sources[0]!.source).to.equal(true); expect(changes[0]!.next === next.sources[0]!.source).to.equal(true);
    peer.operations.length = 0; changes.length = 0;
    expect((await registry.reconcile(peer, 1, empty(), [], { ...context(), beforeSourceChange })).ok).to.equal(true);
    expect(changes[0]!.reason).to.equal('remove'); expect(changes[0]!.next).to.equal(undefined); registry.dispose();
  });

  it('notifies in-place updates before native operations and leaves no hook on no-op or style replay', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources(); const changes: MapOwnedSourceChange[] = [];
    const ctx = { ...context(), beforeSourceChange: (change: MapOwnedSourceChange) => { changes.push(change); peer.operations.push(`hook:${change.reason}`); } };
    const before = imageOverlay(), next = imageOverlay('https://example.test/b.png');
    await registry.reconcile(peer, 1, before, [], ctx); expect(changes.length).to.equal(0);
    peer.operations.length = 0; peer.planSourceUpdate = () => () => { peer.operations.push('update'); };
    await registry.reconcile(peer, 1, next, [], ctx); expect(peer.operations).to.deep.equal(['hook:update', 'update']);
    await registry.reconcile(peer, 1, next, [], ctx); expect(changes.length).to.equal(1);
    peer.sources.clear(); peer.layers.clear(); peer.order = [];
    await registry.reconcile(peer, 2, next, [], ctx); expect(changes.length).to.equal(1); registry.dispose();
  });

  it('completes admission before notifying and does not mutate on a throwing or cancelling hook', async () => {
    for (const mode of ['throw', 'cancel'] as const) {
      const peer = new ResourcePeer(), registry = new MapOwnedResources(); const before = imageOverlay();
      await registry.reconcile(peer, 1, before, [], context()); peer.operations.length = 0;
      const result = await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], {
        ...context(), beforeSourceChange: () => { if (mode === 'cancel') registry.cancel(); else throw new Error('private hook message'); },
      });
      expect(result).to.deep.equal({ ok: false, code: mode === 'cancel' ? 'aborted' : 'peer', rollbackFailed: false });
      expect(peer.operations.length).to.equal(0); expect(peer.getSource('coverage') === before.sources[0]!.source).to.equal(true);
      let calls = 0; const invalid = admission({ sources: [], layers: [{ layer: { id: 'invalid', type: 'circle', source: 'missing' } }] });
      await registry.reconcile(peer, 1, invalid, [], { ...context(), beforeSourceChange: () => { calls++; } });
      expect(calls).to.equal(0); registry.dispose();
    }
  });

  it('rejects recursive reconciliation during a source hook without losing the current owner', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, imageOverlay(), [], context());
    let nested: Promise<unknown> | undefined;
    const result = await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], {
      ...context(), beforeSourceChange: () => { nested = registry.reconcile(peer, 1, empty(), [], context()); },
    });
    expect(result.ok).to.equal(true); expect(await nested).to.deep.equal({ ok: false, code: 'reentrant', rollbackFailed: false }); registry.dispose();
  });

  it('does not notify a later source after the first hook makes the transaction stale', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources();
    const before = admission({ sources: [{ id: 'a', source: { type: 'geojson', data: {} } }, { id: 'b', source: { type: 'geojson', data: {} } }] });
    await registry.reconcile(peer, 1, before, [], context()); peer.operations.length = 0;
    let current = true; const ids: string[] = [];
    const result = await registry.reconcile(peer, 1, empty(), [], { ...context(), isCurrent: () => current,
      beforeSourceChange: change => { ids.push(change.id); current = false; } });
    expect(result).to.deep.equal({ ok: false, code: 'aborted', rollbackFailed: false });
    expect(ids).to.deep.equal(['a']); expect(peer.operations.length).to.equal(0); expect(peer.sources.size).to.equal(2); registry.dispose();
  });

  it('notifies rollback replacement before rollback layer retirement with the actual journal descriptors', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources(); const before = imageOverlay(), next = imageOverlay('https://example.test/b.png');
    await registry.reconcile(peer, 1, before, [], context()); peer.operations.length = 0;
    peer.planSourceUpdate = (_id, _previous, desired) => () => { peer.sources.set('coverage', desired); peer.operations.push('partial'); throw new Error('native failure'); };
    const changes: MapOwnedSourceChange[] = [];
    const result = await registry.reconcile(peer, 1, next, [], { ...context(), beforeSourceChange: change => {
      changes.push(change); if (change.reason === 'rollback') expect(peer.operations).to.deep.equal(['partial']);
    } });
    expect(result).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
    expect(changes.map(change => change.reason)).to.deep.equal(['update', 'rollback']);
    expect(changes[1]!.previous === next.sources[0]!.source).to.equal(true); expect(changes[1]!.next === before.sources[0]!.source).to.equal(true); registry.dispose();
  });

  it('stops rollback native mutations when its source hook cancels ownership', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, imageOverlay(), [], context());
    peer.operations.length = 0; peer.planSourceUpdate = () => () => { peer.operations.push('partial'); throw new Error('native failure'); };
    const result = await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], {
      ...context(), beforeSourceChange: change => { if (change.reason === 'rollback') registry.cancel(); },
    });
    expect(result).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true }); expect(peer.operations).to.deep.equal(['partial']); registry.dispose();
  });

  it('plans changed sources before mutation and retains dependent layers for an in-place update', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    const before = imageOverlay(); const next = imageOverlay('https://example.test/b.png');
    await registry.reconcile(peer, 1, before, [], context());
    const source = peer.getSource('coverage'); const layer = peer.getLayer('coverage-layer');
    peer.operations.length = 0; let plans = 0;
    peer.planSourceUpdate = (id, previous, desired) => {
      plans += 1; expect(id).to.equal('coverage');
      expect(previous === before.sources[0]!.source).to.equal(true);
      expect(desired === next.sources[0]!.source).to.equal(true);
      expect(peer.operations.length).to.equal(0);
      return () => { peer.operations.push('update:coverage'); };
    };
    expect((await registry.reconcile(peer, 1, next, [], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['update:coverage']);
    expect(peer.getSource('coverage') === source).to.equal(true);
    expect(peer.getLayer('coverage-layer') === layer).to.equal(true);
    peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, next, [], context())).ok).to.equal(true);
    expect(plans).to.equal(1); expect(peer.operations.length).to.equal(0); registry.dispose();
  });

  it('replaces unsupported source changes in dependency order', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, imageOverlay(), [], context()); peer.operations.length = 0;
    peer.planSourceUpdate = () => undefined;
    expect((await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['layer-coverage-layer', 'source-coverage', 'source+coverage', 'layer+coverage-layer']);
    registry.dispose();
  });

  it('rolls back a partially applied source update by replacing its source and dependent layer', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const before = imageOverlay();
    await registry.reconcile(peer, 1, before, [], context()); peer.operations.length = 0;
    peer.planSourceUpdate = (_id, _previous, next) => () => {
      peer.sources.set('coverage', next); peer.operations.push('partial-update'); throw new Error('native update failure');
    };
    const result = await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context());
    expect(result).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
    expect(peer.operations).to.deep.equal(['partial-update', 'layer-coverage-layer', 'source-coverage', 'source+coverage', 'layer+coverage-layer']);
    expect(peer.getSource('coverage') === before.sources[0]!.source).to.equal(true);
    expect(peer.order).to.deep.equal(['coverage-layer']);
    peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, before, [], context())).ok).to.equal(true);
    expect(peer.operations.length).to.equal(0); registry.dispose();
  });

  it('rechecks cancellation after planning without applying the returned update', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, imageOverlay(), [], context()); peer.operations.length = 0;
    peer.planSourceUpdate = () => { registry.cancel(); return () => { peer.operations.push('obsolete-update'); }; };
    const result = await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context());
    expect(result).to.deep.equal({ ok: false, code: 'aborted', rollbackFailed: false });
    expect(peer.operations.length).to.equal(0); registry.dispose();
  });

  it('sanitizes a planning error before any native source or layer mutation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const before = imageOverlay();
    await registry.reconcile(peer, 1, before, [], context()); peer.operations.length = 0;
    peer.planSourceUpdate = () => { throw new Error('private native planning detail'); };
    expect(await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context())).to.deep.equal({
      ok: false, code: 'peer', rollbackFailed: false,
    });
    expect(peer.operations.length).to.equal(0);
    expect(peer.getSource('coverage') === before.sources[0]!.source).to.equal(true); registry.dispose();
  });

  it('lets a request started during planning supersede the outer update before mutation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, imageOverlay(), [], context()); peer.operations.length = 0;
    let nested: ReturnType<MapOwnedResources['reconcile']> | undefined;
    peer.planSourceUpdate = () => {
      peer.planSourceUpdate = undefined;
      nested = registry.reconcile(peer, 1, imageOverlay('https://example.test/c.png'), [], context());
      return () => { peer.operations.push('obsolete-update'); };
    };
    expect(await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context())).to.deep.equal({
      ok: false, code: 'aborted', rollbackFailed: false,
    });
    expect((await nested!).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['layer-coverage-layer', 'source-coverage', 'source+coverage', 'layer+coverage-layer']);
    expect((peer.getSource('coverage') as Record<string, unknown>)['url']).to.equal('https://example.test/c.png'); registry.dispose();
  });

  it('keeps the replacement descriptor journal when an update cancels after mutation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const before = imageOverlay();
    await registry.reconcile(peer, 1, before, [], context()); peer.operations.length = 0;
    peer.planSourceUpdate = (_id, _previous, next) => () => { peer.sources.set('coverage', next); registry.cancel(); };
    const result = await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context());
    expect(result).to.deep.equal({ ok: false, code: 'aborted', rollbackFailed: false });
    expect(peer.operations.length).to.equal(0);
    peer.planSourceUpdate = () => undefined;
    expect((await registry.reconcile(peer, 1, before, [], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['layer-coverage-layer', 'source-coverage', 'source+coverage', 'layer+coverage-layer']);
    expect(peer.getSource('coverage') === before.sources[0]!.source).to.equal(true); registry.dispose();
  });

  it('threads current ownership into combined native canvas updates and stops after cancellation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const canvas = document.createElement('canvas');
    const wanted = (offset: number, animate: boolean) => admission({
      sources: [{ id: 'canvas', source: { type: 'canvas', canvas, animate,
        coordinates: [[offset, 1], [offset + 1, 1], [offset + 1, 0], [offset, 0]] } }],
      layers: [{ layer: { id: 'canvas-layer', type: 'raster', source: 'canvas' } }],
    });
    await registry.reconcile(peer, 1, wanted(0, true), [], context()); peer.operations.length = 0;
    const calls: string[] = [];
    const native = { setCoordinates() { calls.push('coordinates'); registry.cancel(); }, pause() { calls.push('pause'); } };
    peer.sources.set('canvas', native);
    peer.planSourceUpdate = (_id, previous, next, checkCurrent) => planMapSourceUpdate(native, previous, next, checkCurrent);
    expect(await registry.reconcile(peer, 1, wanted(2, false), [], context())).to.deep.equal({
      ok: false, code: 'aborted', rollbackFailed: false,
    });
    expect(calls).to.deep.equal(['coordinates']); expect(peer.operations.length).to.equal(0);
    expect(peer.getSource('canvas') === native).to.equal(true);
    let replanned = false;
    peer.planSourceUpdate = () => { replanned = true; return () => undefined; };
    expect((await registry.reconcile(peer, 1, wanted(2, false), [], context())).ok).to.equal(true);
    expect(replanned).to.equal(false);
    expect(peer.operations).to.deep.equal(['layer-canvas-layer', 'source-canvas', 'source+canvas', 'layer+canvas-layer']);
    expect((peer.getSource('canvas') as Record<string, unknown>)['animate']).to.equal(false);
    peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, wanted(2, false), [], context())).ok).to.equal(true);
    expect(peer.operations.length).to.equal(0); registry.dispose();
  });

  it('rejects recursive reconciliation during an update and still rolls back a native throw', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const before = imageOverlay();
    await registry.reconcile(peer, 1, before, [], context());
    let nested: ReturnType<MapOwnedResources['reconcile']> | undefined;
    peer.planSourceUpdate = () => () => {
      nested = registry.reconcile(peer, 1, empty(), [], context()); throw new Error('native update failure');
    };
    const result = await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context());
    expect(await nested!).to.deep.equal({ ok: false, code: 'reentrant', rollbackFailed: false });
    expect(result).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
    expect(peer.getSource('coverage') === before.sources[0]!.source).to.equal(true); registry.dispose();
  });

  it('marks a source update uncertain when it cancels and throws after native mutation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, imageOverlay(), [], context());
    peer.planSourceUpdate = (_id, _previous, next) => () => {
      peer.sources.set('coverage', next); registry.cancel(); throw new Error('native update failure');
    };
    expect(await registry.reconcile(peer, 1, imageOverlay('https://example.test/b.png'), [], context())).to.deep.equal({
      ok: false, code: 'peer', rollbackFailed: true,
    });
    expect(await registry.reconcile(peer, 1, imageOverlay(), [], context())).to.deep.equal({
      ok: false, code: 'peer', rollbackFailed: true,
    });
    registry.dispose();
  });

  it('prepares actual descriptors, adds in dependency order, preserves no-op resources and removes in reverse order', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const image = prepared('pin');
    const wanted = overlay(); let requirements: unknown;
    const result = await registry.reconcile(peer, 1, wanted, [image.resource], {
      isCurrent: current, prepare: async value => { requirements = value; },
    });
    expect(result.ok).to.equal(true);
    expect(requirements).to.deep.equal({ sources: { points: wanted.sources[0]!.source }, layers: [wanted.layers[0]!.layer] });
    expect(peer.operations).to.deep.equal(['image+pin', 'source+points', 'layer+dots']);
    const source = peer.getSource('points'); peer.operations.length = 0;
    const equalDescriptors = admission({
      sources: wanted.sources.map(entry => ({ ...entry, source: { ...entry.source } })),
      layers: structuredClone(wanted.layers),
    });
    expect((await registry.reconcile(peer, 1, equalDescriptors, [image.resource], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal([]); expect(peer.getSource('points') === source).to.equal(true);
    await registry.reconcile(peer, 1, empty(), [], context());
    expect(peer.operations).to.deep.equal(['layer-dots', 'source-points', 'image-pin']);
    expect(image.disposals).to.equal(1); registry.dispose();
  });

  it('rejects basemap source, layer and image collisions before any mutation', async () => {
    for (const kind of ['source', 'layer', 'image']) {
      const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const image = prepared('pin');
      if (kind === 'source') peer.sources.set('points', {});
      if (kind === 'layer') { peer.layers.set('dots', { id: 'dots', type: 'background' }); peer.order.push('dots'); }
      if (kind === 'image') peer.images.set('pin', new ImageData(1, 1));
      const result = await registry.reconcile(peer, 1, overlay(), [image.resource], context());
      expect(result.ok).to.equal(false);
      if (!result.ok) expect(result.code).to.equal('collision');
      expect(peer.operations).to.deep.equal([]); expect(image.disposals).to.equal(1);
      registry.dispose();
    }
  });

  it('retains prepared images across style replay and replaces a changed image in place, keeping its layers', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const image = prepared('pin');
    const wanted = overlay();
    await registry.reconcile(peer, 1, wanted, [image.resource], context());
    peer.sources.clear(); peer.layers.clear(); peer.images.clear(); peer.order = []; peer.operations.length = 0;
    await registry.reconcile(peer, 2, wanted, [image.resource], context());
    expect(peer.operations).to.deep.equal(['image+pin', 'source+points', 'layer+dots']);
    expect(image.disposals).to.equal(0);
    const replacement = prepared('pin'); peer.operations.length = 0;
    peer.after = operation => {
      if (operation === 'image-pin') { expect(peer.layers.size).to.equal(1); expect(image.disposals).to.equal(0); }
    };
    await registry.reconcile(peer, 2, wanted, [replacement.resource], context());
    expect(peer.operations).to.deep.equal(['image-pin', 'image+pin']);
    expect(image.disposals).to.equal(1); expect(replacement.disposals).to.equal(0);
    registry.dispose(); expect(replacement.disposals).to.equal(1);
  });

  it('replaces its own images that a diffed style swap kept, instead of reporting a collision', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const pin = prepared('pin'), flag = prepared('flag');
    await registry.reconcile(peer, 1, overlay(), [pin.resource, flag.resource], context());
    // The engine diffed the style: runtime sources and layers went, runtime images stayed.
    peer.sources.clear(); peer.layers.clear(); peer.order = []; peer.operations.length = 0;
    const result = await registry.reconcile(peer, 2, overlay(), [pin.resource], context());
    expect(result.ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['image-pin', 'image+pin', 'source+points', 'layer+dots', 'image-flag']);
    expect(peer.images.has('flag')).to.equal(false);
    peer.images.set('stranger', new ImageData(1, 1));
    const collision = await registry.reconcile(peer, 3, overlay(), [pin.resource, prepared('stranger').resource], context());
    expect(collision.ok).to.equal(false); registry.dispose();
  });

  it('adds and removes images incrementally without touching unrelated or dependent layers', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    const pin = prepared('pin'), flag = prepared('flag');
    const wanted = overlay();
    await registry.reconcile(peer, 1, wanted, [pin.resource], context()); peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, wanted, [pin.resource, flag.resource], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['image+flag']);
    peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, wanted, [flag.resource], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['image-pin']); expect(pin.disposals).to.equal(1);
    expect(peer.layers.has('dots')).to.equal(true); registry.dispose();
  });

  it('registers signed-distance-field images with the sdf option', async () => {
    const options: unknown[] = [];
    const peer = new ResourcePeer();
    peer.addImage = (id: string, image: ImageData, value?: unknown) => { peer.images.set(id, image); options.push(value); };
    const registry = new MapOwnedResources(); const body = prepared('body');
    const sdf: PreparedMapImage = { ...body.resource, sdf: true, get image() { return body.resource.image; }, dispose: () => body.resource.dispose() };
    expect((await registry.reconcile(peer, 1, empty(), [sdf, prepared('plain').resource], context())).ok).to.equal(true);
    expect(options).to.deep.equal([{ pixelRatio: 1, sdf: true }, { pixelRatio: 1 }]); registry.dispose();
  });

  it('keeps previous resources usable on preparation rejection and sanitizes the result', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, overlay(), [], context()); peer.operations.length = 0;
    const image = prepared('pin');
    const result = await registry.reconcile(peer, 1, overlay('new', 'fresh'), [image.resource], {
      isCurrent: current, prepare: async () => { throw new Error('private payload'); },
    });
    expect(result).to.deep.equal({ ok: false, code: 'preparation', rollbackFailed: false });
    expect(peer.operations).to.deep.equal([]); expect(peer.layers.has('dots')).to.equal(true);
    expect(image.disposals).to.equal(1); registry.dispose();
  });

  it('cancels obsolete preparation even when the peer promise ignores abort', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const slow = deferred();
    const old = prepared('old'); let observedSignal: AbortSignal | undefined;
    const first = registry.reconcile(peer, 1, overlay('old', 'old-layer'), [old.resource], {
      isCurrent: current, prepare: async (_requirements, signal) => { observedSignal = signal; return slow.promise; },
    });
    await waitUntil(() => observedSignal !== undefined);
    const second = registry.reconcile(peer, 1, overlay('new', 'new-layer'), [], context());
    expect((await first).ok).to.equal(false); expect(observedSignal!.aborted).to.equal(true);
    expect((await second).ok).to.equal(true); expect(peer.layers.has('old-layer')).to.equal(false);
    expect(old.disposals).to.equal(1); slow.reject(new Error('obsolete')); registry.dispose();
  });

  it('rechecks cancellation performed by the owner predicate before invoking preparation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); let prepared = false;
    const result = await registry.reconcile(peer, 1, overlay(), [], {
      isCurrent: () => { registry.cancel(); return true; },
      prepare: () => { prepared = true; return new Promise<void>(() => undefined); },
    });
    expect(result.ok).to.equal(false); expect(prepared).to.equal(false); registry.dispose();
  });

  it('lets an abort callback own a newer preparation instead of overwriting its peer/style', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const slow = deferred();
    let latest: ReturnType<MapOwnedResources['reconcile']> | undefined;
    const first = registry.reconcile(peer, 1, overlay('old', 'old-layer'), [], {
      isCurrent: current,
      prepare: (_requirements, signal) => {
        signal.addEventListener('abort', () => {
          latest = registry.reconcile(peer, 3, overlay('latest', 'latest-layer'), [], context());
        }, { once: true });
        return slow.promise;
      },
    });
    const interrupted = registry.reconcile(peer, 2, overlay('middle', 'middle-layer'), [], context());
    expect((await first).ok).to.equal(false); expect((await interrupted).ok).to.equal(false);
    expect((await latest!).ok).to.equal(true); expect(peer.order).to.deep.equal(['latest-layer']);
    slow.resolve(); registry.dispose();
  });

  it('retains the partial ownership journal when cancellation interrupts synchronous mutation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    peer.after = operation => { if (operation === 'source+points') registry.cancel(); };
    const interrupted = await registry.reconcile(peer, 1, overlay(), [], context());
    expect(interrupted.ok).to.equal(false);
    peer.after = undefined;
    expect((await registry.reconcile(peer, 1, overlay('new', 'fresh'), [], context())).ok).to.equal(true);
    expect([...peer.sources.keys()]).to.deep.equal(['new']); expect(peer.order).to.deep.equal(['fresh']);
    registry.dispose();
  });

  it('rolls back a partially mutating peer error and preserves previous images', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const old = prepared('pin');
    await registry.reconcile(peer, 1, overlay(), [old.resource], context());
    const image = prepared('pin'); peer.reject = 'layer+fresh';
    const result = await registry.reconcile(peer, 1, overlay('new', 'fresh'), [image.resource], context());
    expect(result).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
    expect([...peer.sources.keys()]).to.deep.equal(['points']);
    expect(peer.order).to.deep.equal(['dots']); expect(peer.images.get('pin') === old.resource.image).to.equal(true);
    expect(old.disposals).to.equal(0); expect(image.disposals).to.equal(1); registry.dispose();
  });

  it('retains pixels when a cancelling peer throws before image removal can be confirmed', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); const old = prepared('pin');
    await registry.reconcile(peer, 1, overlay(), [old.resource], context());
    peer.removeImage = () => { registry.cancel(); throw new Error('private peer payload'); };
    const result = await registry.reconcile(peer, 1, empty(), [], context());
    expect(result).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true });
    expect(old.disposals).to.equal(0); expect(peer.images.has('pin')).to.equal(true);
    expect(await registry.reconcile(peer, 1, empty(), [], context())).to.deep.equal({
      ok: false, code: 'peer', rollbackFailed: true,
    });
    peer.images.clear(); registry.dispose(); expect(old.disposals).to.equal(1);
  });

  it('does not remove a source after a presence probe cancels the request', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, admission({ sources: overlay().sources }), [], context());
    peer.operations.length = 0;
    peer.getSource = id => { registry.cancel(); return peer.sources.get(id); };
    expect((await registry.reconcile(peer, 1, empty(), [], context())).ok).to.equal(false);
    expect(peer.operations).to.deep.equal([]); expect(peer.sources.has('points')).to.equal(true);
    registry.dispose();
  });

  it('orders layers against basemap anchors and rejects cycles without mutation', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    peer.layers.set('labels', { id: 'labels', type: 'background' }); peer.order.push('labels');
    expect((await registry.reconcile(peer, 1, overlay('points', 'dots', { before: 'labels' }), [], context())).ok).to.equal(true);
    expect(peer.order).to.deep.equal(['dots', 'labels']); peer.operations.length = 0;
    const cycle = admission({ layers: [
      { layer: { id: 'a', type: 'background' }, before: 'b' },
      { layer: { id: 'b', type: 'background' }, before: 'a' },
    ] });
    const result = await registry.reconcile(peer, 1, cycle, [], context());
    expect(result.ok).to.equal(false); if (!result.ok) expect(result.code).to.equal('order');
    expect(peer.operations).to.deep.equal([]); registry.dispose();
  });

  it('prevents abort listeners from resurrecting work while disposal drains transactions', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources(); let calls = 0;
    let nested: ReturnType<MapOwnedResources['reconcile']> | undefined;
    const prepare = async (_requirements: unknown, signal: AbortSignal): Promise<void> => {
      calls += 1;
      signal.addEventListener('abort', () => {
        nested = registry.reconcile(peer, 1, overlay(), [], { isCurrent: current, prepare });
      }, { once: true });
      return new Promise<void>(() => undefined);
    };
    const initial = registry.reconcile(peer, 1, overlay(), [], { isCurrent: current, prepare });
    registry.dispose();
    expect((await initial).ok).to.equal(false); expect((await nested!).ok).to.equal(false);
    expect(calls).to.equal(1);
    expect((await registry.reconcile(peer, 2, empty(), [], context())).ok).to.equal(true); registry.dispose();
  });

  it('rejects synchronous recursive reconciliation and cancels pending work on disposal', async () => {
    const peer = new ResourcePeer(); const registry = new MapOwnedResources();
    let nested: ReturnType<MapOwnedResources['reconcile']> | undefined;
    peer.after = operation => { if (operation === 'source+points') nested = registry.reconcile(peer, 1, empty(), [], context()); };
    await registry.reconcile(peer, 1, overlay(), [], context());
    expect((await nested!)?.ok).to.equal(false);
    const work = deferred(); const image = prepared('later');
    const pending = registry.reconcile(peer, 1, overlay(), [image.resource], { isCurrent: current, prepare: () => work.promise });
    registry.dispose(); expect((await pending).ok).to.equal(false); expect(image.disposals).to.equal(1);
    work.resolve();
  });
});


describe('owned source identity reconciliation', () => {
  it('updates distinct equal-content GeoJSON references without removing their layer', async () => {
    const registry = new MapOwnedResources(); const peer = new ResourcePeer();
    const first = { type: 'FeatureCollection', features: [] }, second = { type: 'FeatureCollection', features: [] };
    const input = (data: unknown) => admission({ sources: [{ id: 'points', source: { type: 'geojson', data } }],
      layers: [{ layer: { id: 'dots', type: 'circle', source: 'points' } }] });
    const calls: unknown[] = []; const changes: string[] = [];
    const native = { setData(value: unknown) { calls.push(value); } };
    peer.planSourceUpdate = (id, previous, next, check) => planMapSourceUpdate(peer.getSource(id), previous, next, check);
    const ctx = { ...context(), beforeSourceChange: (change: MapOwnedSourceChange) => { changes.push(change.reason); } };
    try {
      expect((await registry.reconcile(peer, 1, input(first), [], ctx)).ok).to.equal(true);
      peer.sources.set('points', native); const layer = peer.getLayer('dots'); peer.operations.length = 0;
      expect((await registry.reconcile(peer, 1, input(second), [], ctx)).ok).to.equal(true);
      expect(calls.length).to.equal(1); expect(calls[0] === second).to.equal(true);
      expect(changes).to.deep.equal(['update']); expect(peer.operations).to.deep.equal([]);
      expect(peer.getLayer('dots') === layer).to.equal(true); expect(peer.getSource('points') === native).to.equal(true);
      expect((await registry.reconcile(peer, 1, input(second), [], ctx)).ok).to.equal(true);
      expect(calls.length).to.equal(1); expect(changes).to.deep.equal(['update']);
    } finally { registry.dispose(); }
  });
});


class MutableResourcePeer extends ResourcePeer {
  beforeSetter?: (operation: string) => void;
  readonly featureState = new Map<string, unknown>();
  override addLayer(layer: Readonly<Record<string, unknown>>, before?: string): void {
    super.addLayer({ ...layer, paint: { ...(layer['paint'] as Record<string, unknown> | undefined) }, layout: { ...(layer['layout'] as Record<string, unknown> | undefined) } }, before);
  }
  override removeSource(id: string): void { super.removeSource(id); this.featureState.delete(id); }
  private write(operation: string, apply: () => void): void {
    this.operations.push(operation); this.beforeSetter?.(operation); apply(); this.after?.(operation);
    if (this.reject === operation) { this.reject = undefined; throw new Error('private setter detail'); }
  }
  setPaintProperty(id: string, name: string, value: unknown): void {
    this.write(`paint:${id}:${name}`, () => {
      const paint = this.layers.get(id)!['paint'] as Record<string, unknown>;
      if (value === null) delete paint[name]; else paint[name] = value;
    });
  }
  setLayoutProperty(id: string, name: string, value: unknown): void {
    this.write(`layout:${id}:${name}`, () => {
      const layout = this.layers.get(id)!['layout'] as Record<string, unknown>;
      if (value === null) delete layout[name]; else layout[name] = value;
    });
  }
  setFilter(id: string, value: unknown): void {
    this.write(`filter:${id}`, () => {
      const layer = this.layers.get(id)! as Record<string, unknown>;
      if (value === null) delete layer['filter']; else layer['filter'] = value;
    });
  }
  setLayerZoomRange(id: string, min: number, max: number): void {
    this.write(`zoom:${id}`, () => { const layer = this.layers.get(id)! as Record<string, unknown>; layer['minzoom'] = min; layer['maxzoom'] = max; });
  }
  triggerRepaint(): void { this.write('repaint', () => {}); }
}
const mutableData = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, properties: {}, geometry: null }] };
const mutableOverlay = (options: Record<string, unknown> = {}, before?: string) => admission({
  sources: [{ id: 'points', source: { type: 'geojson', data: mutableData } }],
  layers: [{ layer: { id: 'dots', type: 'circle', source: 'points', ...options }, ...(before ? { before } : {}) }],
});
const initialMutable = () => mutableOverlay({ paint: { 'circle-color': 'red', 'circle-radius': 2 },
  layout: { visibility: 'visible', 'circle-sort-key': 1 }, filter: ['==', ['get', 'kind'], 'old'], minzoom: 2, maxzoom: 10 });
const nextMutable = () => mutableOverlay({ paint: { 'circle-color': 'blue' }, layout: { visibility: 'none' } });

describe('owned map mutable layer transactions', () => {
  it('updates paint/layout/filter/zoom, unsets omitted members and retains native source/layer/feature state', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, initialMutable(), [], context());
    const source = peer.getSource('points'), layer = peer.getLayer('dots'); peer.featureState.set('points', { selected: true });
    const notifications: MapOwnedSourceChange[] = []; peer.operations.length = 0;
    const ctx = { ...context(), beforeSourceChange: (change: MapOwnedSourceChange) => { notifications.push(change); } };
    expect((await registry.reconcile(peer, 1, nextMutable(), [], ctx)).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['paint:dots:circle-color', 'paint:dots:circle-radius',
      'layout:dots:visibility', 'layout:dots:circle-sort-key', 'filter:dots', 'zoom:dots', 'repaint']);
    expect(peer.getSource('points') === source).to.equal(true); expect(peer.getLayer('dots') === layer).to.equal(true);
    expect(peer.layers.get('dots')!['paint']).to.deep.equal({ 'circle-color': 'blue' });
    expect(peer.layers.get('dots')!['layout']).to.deep.equal({ visibility: 'none' });
    expect(peer.layers.get('dots')!['filter']).to.equal(undefined);
    expect(peer.layers.get('dots')!['minzoom']).to.equal(0); expect(peer.layers.get('dots')!['maxzoom']).to.equal(24);
    expect(peer.featureState.get('points')).to.deep.equal({ selected: true }); expect(notifications).to.deep.equal([]);
    peer.operations.length = 0; await registry.reconcile(peer, 1, nextMutable(), [], ctx);
    expect(peer.operations).to.deep.equal([]); registry.dispose();
  });
  for (const capability of ['setPaintProperty', 'setLayoutProperty', 'setFilter', 'setLayerZoomRange', 'triggerRepaint'] as const) {
    it(`uses dependency replacement when the required ${capability} capability is missing`, async () => {
      const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
      await registry.reconcile(peer, 1, initialMutable(), [], context());
      const source = peer.getSource('points'), layer = peer.getLayer('dots');
      Object.defineProperty(peer, capability, { value: undefined }); peer.operations.length = 0;
      expect((await registry.reconcile(peer, 1, nextMutable(), [], context())).ok).to.equal(true);
      expect(peer.getSource('points') === source).to.equal(true); expect(peer.getLayer('dots') === layer).to.equal(false);
      expect(peer.operations).to.deep.equal(['layer-dots', 'layer+dots']); registry.dispose();
    });
  }
  for (const structural of [{ type: 'fill' }, { 'source-layer': 'places' }, { metadata: { revision: 2 } }]) {
    it(`keeps ${Object.keys(structural)[0]} structural even when mutable fields also change`, async () => {
      const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
      const vector = Object.hasOwn(structural, 'source-layer');
      const input = (changed: boolean) => admission({
        sources: [{ id: 'points', source: vector ? { type: 'vector', url: 'https://example.test/tiles.json' } : { type: 'geojson', data: mutableData } }],
        layers: [{ layer: { id: 'dots', type: 'circle', source: 'points', ...(vector ? { 'source-layer': 'original' } : {}),
          ...(changed ? structural : {}), paint: changed && structural.type === 'fill' ? { 'fill-color': 'blue' } : { 'circle-color': changed ? 'blue' : 'red' } } }],
      });
      await registry.reconcile(peer, 1, input(false), [], context());
      const source = peer.getSource('points'), layer = peer.getLayer('dots'); peer.operations.length = 0;
      await registry.reconcile(peer, 1, input(true), [], context());
      expect(peer.getSource('points') === source).to.equal(true); expect(peer.getLayer('dots') === layer).to.equal(false);
      expect(peer.operations).to.deep.equal(['layer-dots', 'layer+dots']); registry.dispose();
    });
  }
  it('coalesces mutable paint, ordering, image replacement and an in-place source update without replacing retained layers', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(), first = prepared('pin'), second = prepared('pin');
    peer.addLayer({ id: 'labels', type: 'background' });
    const input = (data: unknown, color: string, moved = false) => admission({
      sources: [{ id: 'points', source: { type: 'geojson', data } }],
      layers: [{ layer: { id: 'a', type: 'circle', source: 'points', paint: { 'circle-color': color } }, ...(moved ? { before: 'b' } : {}) },
        { layer: { id: 'b', type: 'circle', source: 'points' }, ...(moved ? { before: 'labels' } : {}) }],
    });
    await registry.reconcile(peer, 1, input(mutableData, 'red'), [first.resource], context());
    let nativeData: unknown = mutableData;
    const native = { setData: (data: unknown) => { nativeData = data; peer.operations.push('setData'); } };
    peer.sources.set('points', native); peer.planSourceUpdate = (id, old, next, guard) => planMapSourceUpdate(peer.getSource(id), old, next, guard);
    const layers = ['a', 'b'].map(id => peer.getLayer(id)), nextData = { ...mutableData, features: [] };
    peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, input(nextData, 'blue', true), [second.resource], context())).ok).to.equal(true);
    expect(peer.getSource('points') === native).to.equal(true); expect(nativeData === nextData).to.equal(true);
    expect(['a', 'b'].every((id, i) => peer.getLayer(id) === layers[i])).to.equal(true);
    expect(peer.order).to.deep.equal(['a', 'b', 'labels']); expect(peer.operations.filter(op => op.startsWith('layer'))).to.deep.equal([]);
    expect(peer.operations.filter(op => op === 'repaint')).to.have.length(1); expect(first.disposals).to.equal(1); expect(second.disposals).to.equal(0);
    registry.dispose(); expect(second.disposals).to.equal(1);
  });
  for (const beforeMutation of [false, true]) {
    it(`journals the failed setter before invocation and restores reverse order (throws before mutation=${beforeMutation})`, async () => {
      const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, initialMutable(), [], context());
      const source = peer.getSource('points'), layer = peer.getLayer('dots'); peer.featureState.set('points', { selected: true });
      peer.operations.length = 0;
      if (beforeMutation) peer.beforeSetter = operation => {
        if (operation === 'paint:dots:circle-radius') { peer.beforeSetter = undefined; throw new Error('setter refused'); }
      }; else peer.reject = 'paint:dots:circle-radius';
      expect(await registry.reconcile(peer, 1, nextMutable(), [], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
      expect(peer.operations).to.deep.equal(['paint:dots:circle-color', 'paint:dots:circle-radius', 'paint:dots:circle-radius', 'paint:dots:circle-color', 'repaint']);
      expect(peer.getSource('points') === source).to.equal(true); expect(peer.getLayer('dots') === layer).to.equal(true);
      expect(peer.layers.get('dots')!['paint']).to.deep.equal({ 'circle-color': 'red', 'circle-radius': 2 });
      expect(peer.featureState.get('points')).to.deep.equal({ selected: true });
      peer.operations.length = 0; expect((await registry.reconcile(peer, 1, nextMutable(), [], context())).ok).to.equal(true);
      expect(peer.getLayer('dots') === layer).to.equal(true); registry.dispose();
    });
  }
  it('restores a completed mutable batch and move after repaint throws without replacing native resources', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); peer.addLayer({ id: 'labels', type: 'background' });
    await registry.reconcile(peer, 1, initialMutable(), [], context()); const layer = peer.getLayer('dots'), source = peer.getSource('points');
    peer.reject = 'repaint'; peer.operations.length = 0;
    const next = admission({ ...nextMutable(), layers: [{ ...nextMutable().layers[0]!, before: 'labels' }] });
    expect(await registry.reconcile(peer, 1, next, [], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
    expect(peer.order).to.deep.equal(['labels', 'dots']); expect(peer.getSource('points') === source).to.equal(true);
    expect(peer.getLayer('dots') === layer).to.equal(true); expect(peer.layers.get('dots')!['paint']).to.deep.equal({ 'circle-color': 'red', 'circle-radius': 2 });
    expect(peer.operations.some(op => op.startsWith('layer') || op.startsWith('source'))).to.equal(false); registry.dispose();
  });
  it('fails closed after rollback throws and reclaims ownership only under a fresh style', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(), image = prepared('pin');
    await registry.reconcile(peer, 1, initialMutable(), [image.resource], context());
    peer.beforeSetter = operation => { if (operation === 'paint:dots:circle-radius') throw new Error('write and restore failed'); };
    expect(await registry.reconcile(peer, 1, nextMutable(), [image.resource], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true });
    peer.beforeSetter = undefined; peer.operations.length = 0;
    expect(await registry.reconcile(peer, 1, nextMutable(), [image.resource], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true });
    expect(peer.operations).to.deep.equal([]); expect(image.disposals).to.equal(0);
    peer.layers.clear(); peer.sources.clear(); peer.order = [];
    expect((await registry.reconcile(peer, 2, nextMutable(), [image.resource], context())).ok).to.equal(true);
    expect(peer.layers.get('dots')!['paint']).to.deep.equal({ 'circle-color': 'blue' });
    registry.dispose(); expect(image.disposals).to.equal(1);
  });
  it('never rolls back a canceled setter and replaces its partial layer on the next safe reconciliation', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, initialMutable(), [], context());
    const source = peer.getSource('points'), layer = peer.getLayer('dots'); peer.operations.length = 0;
    peer.after = operation => { if (operation === 'paint:dots:circle-color') registry.cancel(); };
    expect(await registry.reconcile(peer, 1, nextMutable(), [], context())).to.deep.equal({ ok: false, code: 'aborted', rollbackFailed: false });
    expect(peer.operations).to.deep.equal(['paint:dots:circle-color']); peer.after = undefined; peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, nextMutable(), [], context())).ok).to.equal(true);
    expect(peer.getSource('points') === source).to.equal(true); expect(peer.getLayer('dots') === layer).to.equal(false);
    expect(peer.operations).to.deep.equal(['layer-dots', 'layer+dots']); registry.dispose();
  });
  it('marks cancel-plus-throw uncertain and never mutates the retired transaction again', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, initialMutable(), [], context());
    peer.operations.length = 0; peer.after = operation => {
      if (operation === 'paint:dots:circle-color') { registry.cancel(); throw new Error('cancelled native failure'); }
    };
    expect(await registry.reconcile(peer, 1, nextMutable(), [], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true });
    expect(peer.operations).to.deep.equal(['paint:dots:circle-color']); peer.after = undefined;
    expect(await registry.reconcile(peer, 1, nextMutable(), [], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true });
    expect(peer.operations).to.deep.equal(['paint:dots:circle-color']); registry.dispose();
  });
  it('rejects reentrant setter work without allowing it to steal the current transaction', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, initialMutable(), [], context());
    let nested: Promise<unknown> | undefined;
    peer.after = operation => { if (operation === 'paint:dots:circle-color') nested = registry.reconcile(peer, 1, empty(), [], context()); };
    expect((await registry.reconcile(peer, 1, nextMutable(), [], context())).ok).to.equal(true);
    expect(await nested).to.deep.equal({ ok: false, code: 'reentrant', rollbackFailed: false }); registry.dispose();
  });
  it('replays full descriptors into a fresh style and never replays a mutable diff against missing layers', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, initialMutable(), [], context());
    await registry.reconcile(peer, 1, nextMutable(), [], context()); peer.layers.clear(); peer.sources.clear(); peer.order = []; peer.operations.length = 0;
    expect((await registry.reconcile(peer, 2, nextMutable(), [], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['source+points', 'layer+dots']); registry.dispose();
  });
  it('requires only capabilities used by the admitted change', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, initialMutable(), [], context()); const layer = peer.getLayer('dots');
    Object.defineProperty(peer, 'setFilter', { value: undefined }); peer.operations.length = 0;
    const original = initialMutable();
    const next = admission({ ...original, layers: [{ layer: { ...original.layers[0]!.layer, paint: { 'circle-color': 'blue', 'circle-radius': 2 } } }] });
    expect((await registry.reconcile(peer, 1, next, [], context())).ok).to.equal(true);
    expect(peer.getLayer('dots') === layer).to.equal(true); expect(peer.operations).to.deep.equal(['paint:dots:circle-color', 'repaint']); registry.dispose();
  });
  it('stops restoration immediately when its first restoring setter cancels ownership', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, initialMutable(), [], context());
    let radiusCalls = 0; peer.reject = 'paint:dots:circle-radius'; peer.operations.length = 0;
    peer.after = operation => { if (operation === 'paint:dots:circle-radius' && ++radiusCalls === 2) registry.cancel(); };
    expect(await registry.reconcile(peer, 1, nextMutable(), [], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true });
    expect(peer.operations).to.deep.equal(['paint:dots:circle-color', 'paint:dots:circle-radius', 'paint:dots:circle-radius']); registry.dispose();
  });
  it('keeps mutable recovery pending when the repaint callback supersedes the final commit', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources(); await registry.reconcile(peer, 1, initialMutable(), [], context());
    const source = peer.getSource('points'), layer = peer.getLayer('dots');
    peer.after = operation => { if (operation === 'repaint') registry.cancel(); };
    expect(await registry.reconcile(peer, 1, nextMutable(), [], context())).to.deep.equal({ ok: false, code: 'aborted', rollbackFailed: false });
    peer.after = undefined; peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, nextMutable(), [], context())).ok).to.equal(true);
    expect(peer.getLayer('dots') === layer).to.equal(false); expect(peer.getSource('points') === source).to.equal(true);
    expect(peer.operations).to.deep.equal(['layer-dots', 'layer+dots']); registry.dispose();
  });

  it('keeps mutable values inside existing own-descriptor and bounded-value admission', () => {
    let reads = 0;
    const paint = Object.defineProperty({}, 'circle-color', { enumerable: true, get() { reads++; return 'red'; } });
    for (const options of [
      { paint }, { layout: Object.create({ visibility: 'none' }) as unknown },
      { filter: ['all', ...Array.from({ length: 10_001 }, () => true)] },
    ]) {
      expect(admitMapOverlays({ layers: [{ layer: { id: 'dots', type: 'circle', ...options } }] }).ok).to.equal(false);
    }
    expect(reads).to.equal(0);
  });

  for (const failureAt of ['move', 'repaint', 'restore-cancel'] as const) {
    it(`restores mixed mutable/order work before full source/image/structural rollback (${failureAt})`, async () => {
      const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
      const first = prepared('pin'), second = prepared('pin'); peer.addLayer({ id: 'labels', type: 'background' });
      const nextData = { ...mutableData, features: [] };
      const input = (changed: boolean) => admission({
        sources: [{ id: 'points', source: { type: 'geojson', data: changed ? nextData : mutableData } }],
        layers: [
          { layer: { id: 'a', type: 'circle', source: 'points', paint: { 'circle-color': changed ? 'blue' : 'red' } }, ...(changed ? { before: 'b' } : {}) },
          { layer: { id: 'b', type: changed ? 'fill' : 'circle', source: 'points', paint: changed ? { 'fill-color': 'green' } : { 'circle-color': 'red' } },
            ...(changed ? { before: 'labels' } : {}) },
        ],
      });
      await registry.reconcile(peer, 1, input(false), [first.resource], context());
      const oldPixels = peer.images.get('pin'); let nativeData: unknown = mutableData;
      const native = { setData: (data: unknown) => { nativeData = data; peer.operations.push('setData'); } };
      peer.sources.set('points', native);
      peer.planSourceUpdate = (id, old, next, guard) => planMapSourceUpdate(peer.getSource(id), old, next, guard);
      peer.operations.length = 0; peer.reject = failureAt === 'move' ? 'move:a' : 'repaint';
      let paintCalls = 0;
      if (failureAt === 'restore-cancel') peer.after = operation => {
        if (operation === 'paint:a:circle-color' && ++paintCalls === 2) registry.cancel();
      };
      const changes: MapOwnedSourceChange[] = [], rollbackEntries: string[][] = [], settlements: boolean[] = [];
      const result = await registry.reconcile(peer, 1, input(true), [second.resource], {
        ...context(), beforeSourceChange: change => {
          changes.push(change);
          if (change.reason === 'rollback') rollbackEntries.push([...peer.operations]);
        }, afterMutation: safe => { settlements.push(safe); },
      });
      expect(result).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: failureAt === 'restore-cancel' });
      expect(nativeData === nextData).to.equal(true);
      expect(peer.operations.slice(0, 6)).to.deep.equal(['layer-b', 'image-pin', 'image+pin', 'setData', 'paint:a:circle-color', 'layer+b']);
      if (failureAt === 'restore-cancel') {
        expect(changes.map(change => change.reason)).to.deep.equal(['update']);
        expect(peer.operations.slice(-2)).to.deep.equal(['move:a', 'paint:a:circle-color']);
        expect(peer.getSource('points') === native).to.equal(true); expect(peer.images.get('pin') === second.resource.image).to.equal(true);
        expect(settlements).to.deep.equal([false]); expect(first.disposals).to.equal(0); expect(second.disposals).to.equal(0);
        const operations = [...peer.operations]; peer.after = undefined;
        expect(await registry.reconcile(peer, 1, input(true), [second.resource], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: true });
        expect(peer.operations).to.deep.equal(operations);
      } else {
        expect(changes.map(change => change.reason)).to.deep.equal(['update', 'rollback']);
        expect(rollbackEntries).to.have.length(1);
        expect(rollbackEntries[0]!.slice(-2)).to.deep.equal(['move:a', 'paint:a:circle-color']);
        expect(changes[1]!.previous?.['data'] === nextData).to.equal(true); expect(changes[1]!.next?.['data'] === mutableData).to.equal(true);
        expect((peer.getSource('points') as { data: unknown }).data === mutableData).to.equal(true);
        expect(peer.layers.get('a')!['paint']).to.deep.equal({ 'circle-color': 'red' });
        expect(peer.layers.get('b')!['type']).to.equal('circle'); expect(peer.layers.get('b')!['paint']).to.deep.equal({ 'circle-color': 'red' });
        expect(peer.order).to.deep.equal(['labels', 'a', 'b']); expect(peer.images.get('pin') === oldPixels).to.equal(true);
        expect(settlements).to.deep.equal([true]); expect(first.disposals).to.equal(0); expect(second.disposals).to.equal(1);
      }
      if (failureAt === 'restore-cancel') {
        peer.sources.clear(); peer.layers.clear(); peer.order = []; peer.addLayer({ id: 'labels', type: 'background' });
      }
      const recovered = prepared('pin');
      expect((await registry.reconcile(peer, failureAt === 'restore-cancel' ? 2 : 1, input(true), [recovered.resource], context())).ok).to.equal(true);
      expect((peer.getSource('points') as { data: unknown }).data === nextData).to.equal(true);
      expect(peer.layers.get('a')!['paint']).to.deep.equal({ 'circle-color': 'blue' });
      expect(peer.layers.get('b')!['type']).to.equal('fill'); expect(peer.order).to.deep.equal(['a', 'b', 'labels']);
      expect(peer.images.get('pin') === recovered.resource.image).to.equal(true);
      expect(first.disposals).to.equal(1); expect(second.disposals).to.equal(1); expect(recovered.disposals).to.equal(0);
      registry.dispose(); expect(recovered.disposals).to.equal(1);
    });
  }

});

describe('owned map resource boundaries', () => {
  it('sets a zoom range on a layer that had none and restores the previous range when the repaint fails', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, mutableOverlay(), [], context()); peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, mutableOverlay({ minzoom: 3 }), [], context())).ok).to.equal(true);
    expect(peer.operations).to.deep.equal(['zoom:dots', 'repaint']);
    expect(peer.layers.get('dots')!['minzoom']).to.equal(3); expect(peer.layers.get('dots')!['maxzoom']).to.equal(24);
    peer.operations.length = 0; peer.reject = 'repaint';
    expect(await registry.reconcile(peer, 1, mutableOverlay({ maxzoom: 8 }), [], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
    expect(peer.operations).to.deep.equal(['zoom:dots', 'repaint', 'zoom:dots', 'repaint']);
    expect(peer.layers.get('dots')!['minzoom']).to.equal(3); expect(peer.layers.get('dots')!['maxzoom']).to.equal(24);
    registry.dispose();
  });

  it('replaces a layer whose paint is not a record instead of updating it property by property', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
    await registry.reconcile(peer, 1, mutableOverlay({ paint: ['legacy'] }), [], context());
    const source = peer.getSource('points'), layer = peer.getLayer('dots'); peer.operations.length = 0;
    expect((await registry.reconcile(peer, 1, mutableOverlay({ paint: ['replacement'] }), [], context())).ok).to.equal(true);
    expect(peer.getSource('points') === source).to.equal(true); expect(peer.getLayer('dots') === layer).to.equal(false);
    expect(peer.operations).to.deep.equal(['layer-dots', 'layer+dots']); registry.dispose();
  });

  it('puts the original anchored order back when a replacement fails part-way', async () => {
    const peer = new MutableResourcePeer(), registry = new MapOwnedResources();
    peer.addLayer({ id: 'labels', type: 'background' }); peer.addLayer({ id: 'top', type: 'background' });
    const anchored = (type: string) => admission({ sources: [{ id: 'points', source: { type: 'geojson', data: mutableData } }],
      layers: [{ layer: { id: 'dots', type, source: 'points' }, before: 'top' }] });
    expect((await registry.reconcile(peer, 1, anchored('circle'), [], context())).ok).to.equal(true);
    expect(peer.order).to.deep.equal(['labels', 'dots', 'top']);
    peer.reject = 'layer+dots';
    expect(await registry.reconcile(peer, 1, anchored('fill'), [], context())).to.deep.equal({ ok: false, code: 'peer', rollbackFailed: false });
    expect(peer.order).to.deep.equal(['labels', 'dots', 'top']); expect(peer.layers.get('dots')!['type']).to.equal('circle');
    registry.dispose();
  });

  it('refuses layers whose anchors depend on each other before touching the engine', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources();
    const cyclic = admission({ sources: [{ id: 'points', source: { type: 'geojson', data: {} } }],
      layers: [{ layer: { id: 'a', type: 'circle', source: 'points' }, before: 'b' }, { layer: { id: 'b', type: 'circle', source: 'points' }, before: 'a' }] });
    expect(await registry.reconcile(peer, 1, cyclic, [], context())).to.deep.equal({ ok: false, code: 'order', rollbackFailed: false });
    expect(peer.operations).to.deep.equal([]); registry.dispose();
  });

  it('reports through afterMutation whether the engine may be restored from retained pixels', async () => {
    const outcomes: Array<[string, boolean]> = [];
    for (const scenario of ['success', 'superseded', 'rolled back', 'rollback failed'] as const) {
      const peer = new ResourcePeer(), registry = new MapOwnedResources(); let settled: boolean | undefined;
      const ctx = { ...context(), isCurrent: () => scenario !== 'superseded', afterMutation: (safe: boolean) => { settled = safe; } };
      if (scenario === 'rolled back' || scenario === 'rollback failed') peer.reject = 'source+points';
      if (scenario === 'rollback failed') peer.removeSource = () => { throw new Error('private peer payload'); };
      await registry.reconcile(peer, 1, overlay(), [], ctx);
      outcomes.push([scenario, settled!]); registry.dispose();
    }
    expect(outcomes).to.deep.equal([['success', true], ['superseded', false], ['rolled back', true], ['rollback failed', false]]);
  });

  it('releases images offered while the registry is mutating and keeps the ones it owns', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources(), own = prepared('own'), offered = prepared('offered');
    let nested: Promise<unknown> | undefined;
    peer.after = operation => { if (operation === 'source+points' && !nested) nested = registry.reconcile(peer, 1, empty(), [offered.resource], context()); };
    expect((await registry.reconcile(peer, 1, overlay(), [own.resource], context())).ok).to.equal(true);
    expect(await nested).to.deep.equal({ ok: false, code: 'reentrant', rollbackFailed: false });
    expect(offered.disposals).to.equal(1); expect(own.disposals).to.equal(0);
    registry.dispose(); expect(own.disposals).to.equal(1);
  });

  it('releases images offered while the registry is being disposed', async () => {
    const registry = new MapOwnedResources(), peer = new ResourcePeer(), owned = prepared('owned'), late = prepared('late');
    let attempt: Promise<unknown> | undefined;
    const closing = { ...owned.resource, dispose() { owned.resource.dispose(); attempt = registry.reconcile(peer, 1, empty(), [late.resource], context()); } } as PreparedMapImage;
    await registry.reconcile(peer, 1, empty(), [closing], context());
    registry.dispose();
    expect(await attempt).to.deep.equal({ ok: false, code: 'aborted', rollbackFailed: false });
    expect(late.disposals).to.equal(1); expect(owned.disposals).to.equal(1);
  });

  it('ignores a second disposal requested while the first is still releasing images', async () => {
    const registry = new MapOwnedResources(), first = prepared('a'), second = prepared('b'); let released = 0;
    const wrap = (item: ReturnType<typeof prepared>) => ({ ...item.resource, dispose() { released++; item.resource.dispose(); registry.dispose(); } }) as PreparedMapImage;
    await registry.reconcile(new ResourcePeer(), 1, empty(), [wrap(first), wrap(second)], context());
    expect(() => registry.dispose()).not.to.throw();
    expect(released).to.equal(2); expect(first.disposals).to.equal(1); expect(second.disposals).to.equal(1);
  });

  it('aborts without touching the engine when the owner check itself fails and releases the image', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources(), image = prepared('badge');
    const failing = { isCurrent: () => { throw new Error('owner unavailable'); }, prepare: async () => undefined };
    expect(await registry.reconcile(peer, 1, overlay(), [image.resource], failing)).to.deep.equal({ ok: false, code: 'aborted', rollbackFailed: false });
    expect(peer.operations).to.deep.equal([]); expect(image.disposals).to.equal(1); registry.dispose();
  });

  it('rejects an oversized, repeated or already released image catalog and disposes what it was given', async () => {
    const peer = new ResourcePeer(), registry = new MapOwnedResources();
    const oversized = Array.from({ length: 1025 }, (_, index) => prepared(`icon-${index}`));
    expect(await registry.reconcile(peer, 1, empty(), oversized.map(item => item.resource), context())).to.deep.equal({ ok: false, code: 'invalid-image', rollbackFailed: false });
    expect(oversized.every(item => item.disposals === 1)).to.equal(true);
    const twins = [prepared('same'), prepared('same')];
    expect((await registry.reconcile(peer, 1, empty(), twins.map(item => item.resource), context())).ok).to.equal(false);
    expect(twins.map(item => item.disposals)).to.deep.equal([1, 1]);
    const released = prepared('gone'); released.resource.dispose();
    expect(await registry.reconcile(peer, 1, empty(), [released.resource], context())).to.deep.equal({ ok: false, code: 'invalid-image', rollbackFailed: false });
    expect(peer.operations).to.deep.equal([]); registry.dispose();
  });
});
