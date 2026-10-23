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
