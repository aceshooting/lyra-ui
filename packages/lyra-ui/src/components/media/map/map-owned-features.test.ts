import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { MapFeatureStateRoutes } from './map-feature-state-routes.js';
import type { MapFeatureStatePeer } from './map-feature-state.js';
import { MAP_IMAGE_LIMITS } from './map-image-admission.js';
import { MapOwnedFeatures } from './map-owned-features.js';
import type { LyraMapImage, MapImagePreparationContext, MapImagePreparationResult, PreparedMapImage } from './map-images.js';
import type { MapLibreMapCapability } from './map-loader.js';
import type { MapOwnedSourceChange } from './map-owned-resources.js';

const descriptor = (id = 'pin', markup = '<svg/>'): LyraMapImage => ({
  id, source: { kind: 'svg', markup }, width: 1, height: 1, pixelRatio: 1,
});
const overlays = { sources: [{ id: 'points', source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }],
  layers: [{ layer: { id: 'icons', type: 'symbol', source: 'points', layout: { 'icon-image': 'pin' } }, before: 'labels' }] };
class Peer {
  readonly sources = new Map<string, unknown>();
  readonly layers = new Map<string, Record<string, unknown>>([['labels', { id: 'labels', type: 'background' }]]);
  readonly images = new Map<string, ImageData>();
  readonly paint = new Map<string, unknown>([['labels:background-color', '#fff']]);
  readonly layout = new Map<string, unknown>();
  order = ['labels']; calls: string[] = []; requirements: unknown[] = [];
  getStyle() { return { layers: this.order.map(id => this.layers.get(id)!) }; }
  getSource(id: string) { return this.sources.get(id); }
  getLayer(id: string) { return this.layers.get(id); }
  addSource(id: string, value: unknown) { this.sources.set(id, value); this.calls.push(`source+${id}`); }
  removeSource(id: string) { this.sources.delete(id); this.calls.push(`source-${id}`); }
  addLayer(value: Record<string, unknown>, before?: string) {
    const id = value['id'] as string; this.layers.set(id, value);
    this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, id); this.calls.push(`layer+${id}`);
  }
  moveLayer(id: string, before?: string) {
    this.order = this.order.filter(entry => entry !== id);
    this.order.splice(before ? this.order.indexOf(before) : this.order.length, 0, id);
  }
  removeLayer(id: string) { this.layers.delete(id); this.order = this.order.filter(entry => entry !== id); this.calls.push(`layer-${id}`); }
  hasImage(id: string) { return this.images.has(id); }
  addImage(id: string, pixels: ImageData) { this.images.set(id, pixels); this.calls.push(`image+${id}`); }
  removeImage(id: string) { this.images.delete(id); this.calls.push(`image-${id}`); }
  getPaintProperty(id: string, name: string) { return this.paint.get(`${id}:${name}`); }
  setPaintProperty(id: string, name: string, value: unknown) { this.paint.set(`${id}:${name}`, value); }
  getLayoutProperty(id: string, name: string) { return this.layout.get(`${id}:${name}`); }
  setLayoutProperty(id: string, name: string, value: unknown) { this.layout.set(`${id}:${name}`, value); }
  triggerRepaint() { this.calls.push('repaint'); }
  async prepareFeatures(value: unknown) { this.requirements.push(value); }
}
function preparer() {
  let calls = 0; let disposals = 0;
  const prepare = async (input: unknown, _context: MapImagePreparationContext): Promise<MapImagePreparationResult> => {
    calls += 1;
    const images = (input as readonly LyraMapImage[]).map(value => {
      let pixels: ImageData | null = new ImageData(value.width, value.height);
      return { ...value, encodedBytes: 16, decodedPixels: 1, get image() { return pixels; },
        dispose() { if (pixels) { pixels = null; disposals += 1; } },
      } satisfies PreparedMapImage;
    });
    return { ok: true, images, dispose() { images.forEach(image => image.dispose()); } };
  };
  return { prepare, get calls() { return calls; }, get disposals() { return disposals; } };
}
async function harness() {
  const owner = await fixture<HTMLElement>(html`<div></div>`); const peer = new Peer(); const prepare = preparer();
  const features = new MapOwnedFeatures(prepare.prepare); const signal = new AbortController();
  const context = { owner, signal: signal.signal, isCurrent: () => true, isGeneratedLayer: () => false,
    resolve: (value: unknown) => value };
  const run = (input: Parameters<MapOwnedFeatures['reconcile']>[2], style: unknown = 1) =>
    features.reconcile(peer as unknown as MapLibreMapCapability, style, input, context);
  return { owner, peer, prepare, features, signal, context, run };
}

describe('map owned feature integration controller', () => {
  for (const opaque of [false, true]) {
    it(`replaces equal-content GeoJSON identities without traversing payloads (opaque=${opaque})`, async () => {
      const h = await harness(); const states = new MapFeatureStateRoutes();
      let reads = 0;
      const data = () => {
        const properties = opaque ? Object.defineProperty({}, 'nested', {
          enumerable: true, get() { reads += 1; throw new Error('Payload must stay opaque'); },
        }) : { label: 'same' };
        return { type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, geometry: null, properties }] };
      };
      const first = data(), second = data();
      const input = (value: unknown) => ({ overlays: {
        sources: [{ id: 'points', source: { type: 'geojson', data: value } }],
        layers: [{ layer: { id: 'dots', type: 'circle', source: 'points' } }],
      }, images: [], styleOverrides: [] });
      const updates: unknown[] = []; const order: string[] = [];
      const native = { setData(value: unknown) { order.push('setData'); updates.push(value); } };
      const stateCalls: string[] = [];
      const statePeer: MapFeatureStatePeer = {
        getSource: id => h.peer.getSource(id),
        setFeatureState: () => { stateCalls.push('set'); },
        removeFeatureState: (_target, key) => { stateCalls.push(`remove:${key}`); },
      };
      const context = { ...h.context, beforeSourceChange: (change: MapOwnedSourceChange) => {
        order.push(change.reason); states.refreshNative('overlay', change.id);
      } };
      const run = (value: unknown) => h.features.reconcile(h.peer as unknown as MapLibreMapCapability, 1, input(value), context);
      try {
        await run(first); h.peer.sources.set('points', native);
        const layer = h.peer.getLayer('dots'); h.peer.calls.length = 0;
        const route = { origin: 'overlay', source: 'points', nativeSource: 'points', identity: first };
        expect(states.configure([route]).accepted).to.equal(true);
        const target = { origin: 'overlay', source: 'points', id: 1 };
        expect(states.set(target, { selected: true }).accepted).to.equal(true);
        expect(states.replay(statePeer, 1).accepted).to.equal(true);
        await run(second);
        expect(reads).to.equal(0);
        expect(updates.length).to.equal(1); expect(updates[0] === second).to.equal(true);
        expect(order).to.deep.equal(['update', 'setData']);
        expect(h.peer.getSource('points') === native).to.equal(true);
        expect(h.peer.getLayer('dots') === layer).to.equal(true); expect(h.peer.calls).to.deep.equal([]);
        // The component changes the route identity after owned-source reconciliation.
        expect(states.configure([{ ...route, identity: second }]).accepted).to.equal(true);
        expect(states.replay(statePeer, 1).accepted).to.equal(true);
        expect(states.get(target)).to.equal(undefined);
        expect(stateCalls).to.deep.equal(['set', 'remove:selected']);
        await run(second); expect(updates.length).to.equal(1); expect(reads).to.equal(0);
      } finally { states.dispose(); h.features.dispose(); }
    });
  }

  const imageOverlay = (url = 'https://example.test/a.png', offset = 0) => ({
    sources: [{ id: 'coverage', source: { type: 'image', url,
      coordinates: [[offset, 1], [offset + 1, 1], [offset + 1, 0], [offset, 0]] } }],
    layers: [{ layer: { id: 'coverage-layer', type: 'raster', source: 'coverage' } }],
  });

  it('forwards source ownership changes before native retirement and suppresses unchanged/style replay invalidation', async () => {
    const h = await harness(); const changes: MapOwnedSourceChange[] = [];
    const ctx = { ...h.context, beforeSourceChange: (change: MapOwnedSourceChange) => {
      changes.push(change); expect(h.peer.calls.length).to.equal(0);
    } };
    const run = (url: string, style = 1) => h.features.reconcile(h.peer as unknown as MapLibreMapCapability, style,
      { overlays: imageOverlay(url), images: [], styleOverrides: [] }, ctx);
    await run('https://example.test/a.png'); expect(changes.length).to.equal(0); h.peer.calls.length = 0;
    await run('https://example.test/b.png'); expect(changes.map(change => change.reason)).to.deep.equal(['replace']);
    h.peer.calls.length = 0; await run('https://example.test/b.png'); expect(changes.length).to.equal(1);
    h.peer.sources.clear(); h.peer.layers.clear(); h.peer.order = [];
    await run('https://example.test/b.png', 2); expect(changes.length).to.equal(1); h.features.dispose();
  });

  it('aborts source replacement when the forwarded owner hook cancels its feature context', async () => {
    const h = await harness(); const before = imageOverlay();
    await h.run({ overlays: before, images: [], styleOverrides: [] }); h.peer.calls.length = 0;
    let rejected = false;
    try {
      await h.features.reconcile(h.peer as unknown as MapLibreMapCapability, 1,
        { overlays: imageOverlay('https://example.test/b.png'), images: [], styleOverrides: [] },
        { ...h.context, beforeSourceChange: () => { h.signal.abort(); } });
    } catch (error) { rejected = error instanceof DOMException && error.name === 'AbortError'; }
    expect(rejected).to.equal(true); expect(h.peer.calls.length).to.equal(0); expect(h.peer.sources.size).to.equal(1); h.features.dispose();
  });

  it('adapts image changes to actual native source methods while retaining its layer', async () => {
    const h = await harness();
    await h.run({ overlays: imageOverlay(), images: [], styleOverrides: [] });
    const calls: unknown[] = [];
    const native = {
      setCoordinates(this: unknown, value: unknown) { calls.push(this, value); },
      updateImage(this: unknown, value: unknown) { calls.push(this, value); },
    };
    h.peer.sources.set('coverage', native); const layer = h.peer.getLayer('coverage-layer'); h.peer.calls.length = 0;
    const moved = imageOverlay('https://example.test/a.png', 2);
    await h.run({ overlays: moved, images: [], styleOverrides: [] });
    expect(calls[0] === native).to.equal(true); expect(calls[1]).to.deep.equal(moved.sources[0]!.source.coordinates);
    const changed = imageOverlay('https://example.test/b.png', 3);
    await h.run({ overlays: changed, images: [], styleOverrides: [] });
    expect(calls[2] === native).to.equal(true);
    expect(calls[3]).to.deep.equal({ url: changed.sources[0]!.source.url, coordinates: changed.sources[0]!.source.coordinates });
    expect(h.peer.getSource('coverage') === native).to.equal(true);
    expect(h.peer.getLayer('coverage-layer') === layer).to.equal(true);
    expect(h.peer.calls).to.deep.equal([]);
    expect(h.features.ownsLayer('coverage-layer')).to.equal(true);
    expect(h.features.ownsLayer('labels')).to.equal(false);
    h.features.dispose(); expect(h.features.ownsLayer('coverage-layer')).to.equal(false);
  });

  it('adapts same-canvas coordinate and animation changes without replacing its native source', async () => {
    const h = await harness(); const canvas = document.createElement('canvas');
    const input = (offset: number, animate: boolean) => ({ overlays: {
      sources: [{ id: 'canvas', source: { type: 'canvas', canvas, animate, coordinates: [[offset, 1], [offset + 1, 1], [offset + 1, 0], [offset, 0]] } }],
      layers: [{ layer: { id: 'canvas-layer', type: 'raster', source: 'canvas' } }],
    }, images: [], styleOverrides: [] });
    await h.run(input(0, true));
    const calls: string[] = [];
    const native = { setCoordinates() { calls.push('coordinates'); }, pause() { calls.push('pause'); } };
    h.peer.sources.set('canvas', native); h.peer.calls.length = 0;
    await h.run(input(2, false));
    expect(calls).to.deep.equal(['coordinates', 'pause']); expect(h.peer.calls).to.deep.equal([]);
    expect(h.peer.getSource('canvas') === native).to.equal(true); h.features.dispose();
  });

  it('passes cancellation guards through the native adapter between canvas coordinate and animation calls', async () => {
    const h = await harness(); const canvas = document.createElement('canvas');
    const input = (offset: number, animate: boolean) => ({ overlays: {
      sources: [{ id: 'canvas', source: { type: 'canvas', canvas, animate,
        coordinates: [[offset, 1], [offset + 1, 1], [offset + 1, 0], [offset, 0]] } }],
      layers: [{ layer: { id: 'canvas-layer', type: 'raster', source: 'canvas' } }],
    }, images: [], styleOverrides: [] });
    await h.run(input(0, true)); const calls: string[] = [];
    h.peer.sources.set('canvas', { setCoordinates() { calls.push('coordinates'); h.signal.abort(); }, pause() { calls.push('pause'); } });
    h.peer.calls.length = 0;
    const result = await h.run(input(2, false)).catch(error => error as Error);
    expect((result as Error).name).to.equal('AbortError');
    expect(calls).to.deep.equal(['coordinates']); expect(h.peer.calls).to.deep.equal([]); h.features.dispose();
  });

  it('uses dependency-ordered replacement when the native source lacks the update method', async () => {
    const h = await harness(); await h.run({ overlays: imageOverlay(), images: [], styleOverrides: [] });
    h.peer.calls.length = 0;
    await h.run({ overlays: imageOverlay('https://example.test/b.png'), images: [], styleOverrides: [] });
    expect(h.peer.calls).to.deep.equal(['layer-coverage-layer', 'source-coverage', 'source+coverage', 'layer+coverage-layer']);
    h.features.dispose();
  });

  it('excludes another generated owner from basemap style overrides through its ownership hook', async () => {
    const h = await harness(); const generated = new MapOwnedFeatures(h.prepare.prepare);
    await generated.reconcile(h.peer as unknown as MapLibreMapCapability, 1,
      { overlays: imageOverlay(), images: [], styleOverrides: [] }, h.context);
    const context = { ...h.context, isGeneratedLayer: (id: string) => generated.ownsLayer(id) };
    let rejected = false;
    try {
      await h.features.reconcile(h.peer as unknown as MapLibreMapCapability, 1,
        { overlays: {}, images: [], styleOverrides: [{ layerId: 'coverage-layer', layout: { visibility: 'none' } }] }, context);
    } catch (error) { rejected = true; expect((error as Error).name).to.equal('MapResourceError'); }
    expect(rejected).to.equal(true); expect(h.peer.layout.has('coverage-layer:visibility')).to.equal(false);
    generated.dispose(); h.features.dispose();
  });

  it('keeps unset optional capabilities compatible without peer probes or image preparation', async () => {
    const h = await harness();
    await h.features.reconcile({} as MapLibreMapCapability, 1, { overlays: {}, images: [], styleOverrides: [] }, h.context);
    expect(h.prepare.calls).to.equal(0); h.features.dispose();
  });

  it('prepares real descriptors, installs images before layers and replays retained pixels on style change', async () => {
    const h = await harness(); const input = { overlays, images: [descriptor()], styleOverrides: [] };
    await h.run(input); const pixels = h.peer.images.get('pin');
    expect(h.peer.order).to.deep.equal(['icons', 'labels']);
    expect(h.peer.calls.slice(0, 3)).to.deep.equal(['image+pin', 'source+points', 'layer+icons']);
    expect(h.peer.requirements[0]).to.deep.equal({ sources: { points: overlays.sources[0]!.source }, layers: [overlays.layers[0]!.layer] });
    h.peer.sources.clear(); h.peer.images.clear(); h.peer.layers.delete('icons'); h.peer.order = ['labels'];
    await h.run(input, 2); expect(h.prepare.calls).to.equal(1); expect(h.peer.images.get('pin') === pixels).to.equal(true);
    h.features.dispose(); expect(h.prepare.disposals).to.equal(1);
  });

  it('skips native preparation and writes for equal descriptors retaining GeoJSON identity', async () => {
    const h = await harness(); const input = { overlays, images: [descriptor()], styleOverrides: [] };
    await h.run(input); const preparations = h.peer.requirements.length; h.peer.calls.length = 0;
    const equalDescriptors = structuredClone(overlays);
    equalDescriptors.sources[0]!.source.data = overlays.sources[0]!.source.data;
    await h.run({ overlays: equalDescriptors, images: [descriptor()], styleOverrides: [] });
    expect(h.peer.requirements.length).to.equal(preparations); expect(h.peer.calls).to.deep.equal([]);
    expect(h.prepare.calls).to.equal(1); h.features.dispose();
  });

  it('reconciles unchanged layer descriptors when a missing insertion target appears before them', async () => {
    const h = await harness();
    const input = { overlays: { ...overlays, layers: [{ ...overlays.layers[0]!, before: 'future' }] }, images: [], styleOverrides: [] };
    await h.run(input); expect(h.peer.order).to.deep.equal(['labels', 'icons']);
    h.peer.addLayer({ id: 'future', type: 'background' }, 'icons');
    await h.run(input); expect(h.peer.order).to.deep.equal(['labels', 'icons', 'future']);
    h.features.dispose();
  });

  it('reuses unaffected images while preparing replacements and removing old resources', async () => {
    const h = await harness(); await h.run({ overlays, images: [descriptor(), descriptor('other')], styleOverrides: [] });
    const other = h.peer.images.get('other');
    await h.run({ overlays, images: [descriptor('pin', '<svg><circle/></svg>'), descriptor('other')], styleOverrides: [] });
    expect(h.prepare.calls).to.equal(2); expect(h.prepare.disposals).to.equal(1);
    expect(h.peer.images.get('other') === other).to.equal(true);
    await h.run({ overlays: {}, images: [], styleOverrides: [] });
    expect(h.peer.images.size).to.equal(0); expect(h.prepare.disposals).to.equal(3); h.features.dispose();
  });

  it('bounds combined retained and newly prepared image costs', async () => {
    for (const cost of [{ encodedBytes: 5_000_000, decodedPixels: 1 }, { encodedBytes: 16, decodedPixels: 9_000_000 }]) {
      const h = await harness();
      const features = new MapOwnedFeatures(async (input, context) => {
        const result = await h.prepare.prepare(input, context);
        if (!result.ok) return result;
        return { ...result, images: result.images.map(image => ({ ...image, ...cost })) };
      });
      const run = (images: readonly LyraMapImage[]) => features.reconcile(h.peer as unknown as MapLibreMapCapability,
        1, { overlays: {}, images, styleOverrides: [] }, h.context);
      await run([descriptor()]);
      let error: unknown; try { await run([descriptor(), descriptor('other')]); } catch (caught) { error = caught; }
      expect((error as Error).name).to.equal('MapResourceError');
      expect(h.peer.images.has('pin')).to.equal(true); expect(h.peer.images.has('other')).to.equal(false);
      expect(h.prepare.disposals).to.equal(1); features.dispose(); h.features.dispose();
    }
  });

  it('applies basemap overrides after overlays and restores their original values on removal', async () => {
    const h = await harness();
    await h.run({ overlays, images: [], styleOverrides: [{ layerId: 'labels', paint: { 'background-color': '#123' } }] });
    expect(h.peer.paint.get('labels:background-color')).to.equal('#123');
    await h.run({ overlays, images: [], styleOverrides: [] });
    expect(h.peer.paint.get('labels:background-color')).to.equal('#fff');
    let rejected = false;
    try { await h.run({ overlays, images: [], styleOverrides: [{ layerId: 'icons', layout: { visibility: 'none' } }] }); }
    catch (error) { rejected = true; expect((error as Error).message).to.equal('Map resources could not be restored.'); }
    expect(rejected).to.equal(true); h.features.dispose();
  });

  it('rejects invalid input and collisions without exposing caught peer messages', async () => {
    const h = await harness();
    for (const input of [
      { overlays: { layers: [{ layer: { id: 'labels', type: 'background' } }] }, images: [], styleOverrides: [] },
      { overlays: {}, images: [{ ...descriptor(), width: Infinity }], styleOverrides: [] },
    ]) {
      let error: unknown; try { await h.run(input); } catch (caught) { error = caught; }
      expect((error as Error).name).to.equal('MapResourceError');
      expect((error as Error).message).to.equal('Map resources could not be restored.');
    }
    expect(h.peer.order).to.deep.equal(['labels']); h.features.dispose();
  });

  it('cancels obsolete registry preparation before a newer request finishes preparing its image', async () => {
    const h = await harness(); let oldStarted = false;
    h.peer.prepareFeatures = async () => { oldStarted = true; return new Promise<void>(() => undefined); };
    let release!: (result: MapImagePreparationResult) => void;
    const imagePending = new Promise<MapImagePreparationResult>(resolve => { release = resolve; });
    const features = new MapOwnedFeatures(() => imagePending);
    const first = features.reconcile(h.peer as unknown as MapLibreMapCapability, 1,
      { overlays, images: [], styleOverrides: [] }, h.context).catch(error => error as Error);
    await waitUntil(() => oldStarted);
    const second = features.reconcile(h.peer as unknown as MapLibreMapCapability, 1,
      { overlays, images: [descriptor()], styleOverrides: [] }, h.context).catch(error => error as Error);
    expect((await first as Error).name).to.equal('AbortError');
    h.signal.abort(); release(await h.prepare.prepare([descriptor()], h.context));
    expect((await second as Error).name).to.equal('AbortError'); features.dispose(); h.features.dispose();
  });

  it('disposes a late prepared result after cancellation without installing it', async () => {
    const h = await harness(); let release!: (result: MapImagePreparationResult) => void;
    const pending = new Promise<MapImagePreparationResult>(resolve => { release = resolve; });
    const features = new MapOwnedFeatures(() => pending);
    const work = features.reconcile(h.peer as unknown as MapLibreMapCapability, 1,
      { overlays, images: [descriptor()], styleOverrides: [] }, h.context).catch(error => error);
    h.signal.abort(); const result = await h.prepare.prepare([descriptor()], h.context); release(result);
    expect((await work as Error).name).to.equal('AbortError');
    expect(h.peer.images.size).to.equal(0); expect(h.prepare.disposals).to.equal(1); features.dispose(); h.features.dispose();
  });
});


describe('map shared declarative/provider image ownership', () => {
  for (const dimension of ['count', 'bytes', 'pixels']) {
    it(`preserves the valid catalog when declarative growth exceeds the shared ${dimension} budget`, async () => {
      const h = await harness(); let resolver!: ((id: string) => void | Promise<void>) | null;
      Object.assign(h.peer, { setMissingStyleImageResolver(value: typeof resolver) { resolver = value; } });
      const features = new MapOwnedFeatures(async (input, context) => {
        const result = await h.prepare.prepare(input, context);
        if (!result.ok) return result;
        return { ...result, images: result.images.map(image => ({ ...image,
          encodedBytes: dimension === 'bytes' ? Math.floor(MAP_IMAGE_LIMITS.totalBytes / 3) + 1 : 16,
          decodedPixels: dimension === 'pixels' ? Math.floor(MAP_IMAGE_LIMITS.totalPixels / 3) + 1 : 1,
        })) };
      });
      const peer = h.peer as unknown as MapLibreMapCapability;
      const run = (images: readonly LyraMapImage[]) => features.reconcile(peer, 1, { overlays: {}, images, styleOverrides: [] }, h.context);
      try {
        await run([descriptor('existing')]); const existing = h.peer.images.get('existing');
        features.configureImageProvider(peer, (id: string) => descriptor(id), h.owner);
        await resolver!('provided'); const retained = h.peer.images.get('provided');
        const declared = dimension === 'count' ? [descriptor('existing'), ...Array.from({ length: MAP_IMAGE_LIMITS.count - 1 }, (_, index) => descriptor(`declared-${index}`))] : [descriptor('existing'), descriptor('declared')];
        let failure: unknown; try { await run(declared); } catch (error) { failure = error; }
        expect((failure as Error | undefined)?.name).to.equal('MapResourceError');
        expect(h.peer.images.size).to.equal(2); expect(h.peer.images.get('provided') === retained).to.equal(true);
        expect(h.peer.images.get('existing') === existing).to.equal(true);
        expect(h.peer.images.has('declared')).to.equal(false);
      } finally { features.dispose(); h.features.dispose(); }
    });
  }

  it('reserves declarative IDs while native preparation awaits and ignores older provider responses', async () => {
    const h = await harness(); let resolver!: ((id: string) => void | Promise<void>) | null;
    Object.assign(h.peer, { setMissingStyleImageResolver(value: typeof resolver) { resolver = value; } });
    let resolveImage!: (image: LyraMapImage) => void;
    const peer = h.peer as unknown as MapLibreMapCapability;
    h.features.configureImageProvider(peer, () => new Promise<LyraMapImage>(resolve => { resolveImage = resolve; }), h.owner);
    const pending = resolver!('pin');
    let release!: () => void; let entered!: () => void;
    const preparing = new Promise<void>(resolve => { entered = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    h.peer.prepareFeatures = async () => { entered(); await barrier; };
    const updating = h.run({ overlays: {}, images: [descriptor('pin')], styleOverrides: [] });
    try {
      await preparing; resolveImage(descriptor('pin')); await pending;
      expect(h.peer.images.has('pin')).to.equal(false);
      release(); await updating;
      const declared = h.peer.images.get('pin'); expect(declared !== undefined).to.equal(true);
      h.features.configureImageProvider(peer, undefined, h.owner);
      expect(h.peer.images.get('pin') === declared).to.equal(true);
    } finally { release(); await updating.catch(() => undefined); h.features.dispose(); }
  });

  it('restores a displaced provider image if native declarative reconciliation rejects', async () => {
    const h = await harness(); let resolver!: ((id: string) => void | Promise<void>) | null;
    Object.assign(h.peer, { setMissingStyleImageResolver(value: typeof resolver) { resolver = value; } });
    const peer = h.peer as unknown as MapLibreMapCapability;
    h.features.configureImageProvider(peer, (id: string) => descriptor(id), h.owner);
    try {
      await resolver!('pin'); const retained = h.peer.images.get('pin');
      h.peer.prepareFeatures = async () => { throw new Error('Rejected native preparation'); };
      let failure: unknown;
      try { await h.run({ overlays: {}, images: [descriptor('pin')], styleOverrides: [] }); } catch (error) { failure = error; }
      expect((failure as Error | undefined)?.name).to.equal('MapResourceError');
      expect(h.peer.images.get('pin') === retained).to.equal(true);
      h.features.configureImageProvider(peer, undefined, h.owner);
      expect(h.peer.images.has('pin')).to.equal(false);
    } finally { h.features.dispose(); }
  });
});

for (const interruptedBy of ['newer-update', 'reset', 'disconnect']) {
  it(`does not restore obsolete provider ownership after ${interruptedBy}`, async () => {
    const h = await harness(); let resolver!: ((id: string) => void | Promise<void>) | null;
    Object.assign(h.peer, { setMissingStyleImageResolver(value: typeof resolver) { resolver = value; } });
    const peer = h.peer as unknown as MapLibreMapCapability;
    h.features.configureImageProvider(peer, (id: string) => descriptor(id), h.owner);
    await resolver!('pin'); const retained = h.peer.images.get('pin');
    let release!: () => void; let entered!: () => void; let attempts = 0;
    const preparing = new Promise<void>(resolve => { entered = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    h.peer.prepareFeatures = async () => {
      if (attempts++ === 0) { entered(); await barrier; throw new Error('Interrupted preparation'); }
    };
    const older = h.run({ overlays: {}, images: [descriptor('pin')], styleOverrides: [] }).catch(error => error as Error);
    try {
      await preparing;
      if (interruptedBy === 'newer-update') {
        await h.run({ overlays: {}, images: [descriptor('other')], styleOverrides: [] });
      } else if (interruptedBy === 'reset') {
        h.features.configureImageProvider(peer, undefined, h.owner);
      } else { h.owner.remove(); }
      release(); const result = await older; expect(result instanceof Error).to.equal(true);
      if (interruptedBy === 'newer-update') {
        expect(h.peer.images.get('pin') === retained).to.equal(true);
        const declared = h.peer.images.get('other'); expect(declared !== undefined).to.equal(true);
        h.features.configureImageProvider(peer, undefined, h.owner);
        expect(h.peer.images.has('pin')).to.equal(false); expect(h.peer.images.get('other') === declared).to.equal(true);
      } else { expect(h.peer.images.has('pin')).to.equal(false); }
    } finally { release(); await older; h.features.dispose(); }
  });
}


describe('map provider resource rollback boundaries', () => {
  it('stops a detached-image loop after a native callback cancels it', async () => {
    const h = await harness(); let resolver!: ((id: string) => void | Promise<void>) | null;
    Object.assign(h.peer, { setMissingStyleImageResolver(value: typeof resolver) { resolver = value; } });
    const peer = h.peer as unknown as MapLibreMapCapability;
    h.features.configureImageProvider(peer, (id: string) => descriptor(id), h.owner);
    try {
      await resolver!('a'); await resolver!('b'); const a = h.peer.images.get('a'), b = h.peer.images.get('b');
      const removeImage = h.peer.removeImage.bind(h.peer); let once = true;
      h.peer.removeImage = id => { removeImage(id); if (once) { once = false; h.features.cancel(); } };
      let failure: unknown;
      try { await h.run({ overlays: {}, images: [descriptor('a'), descriptor('b')], styleOverrides: [] }); } catch (error) { failure = error; }
      expect((failure as Error | undefined)?.name).to.equal('AbortError');
      expect(h.peer.images.get('a') === a).to.equal(true); expect(h.peer.images.get('b') === b).to.equal(true);
    } finally { h.features.dispose(); }
  });

  it('does not claim or remove a proposed image left behind by failed resource rollback', async () => {
    const h = await harness(); let resolver!: ((id: string) => void | Promise<void>) | null;
    Object.assign(h.peer, { setMissingStyleImageResolver(value: typeof resolver) { resolver = value; } });
    const peer = h.peer as unknown as MapLibreMapCapability;
    h.features.configureImageProvider(peer, (id: string) => descriptor(id), h.owner);
    try {
      await resolver!('pin'); const supplied = h.peer.images.get('pin');
      const addImage = h.peer.addImage.bind(h.peer), removeImage = h.peer.removeImage.bind(h.peer);
      let removals = 0;
      h.peer.addImage = (id, image) => { addImage(id, image); throw new Error('Mutation then failure'); };
      h.peer.removeImage = id => { if (++removals > 1) throw new Error('Rollback removal rejected'); removeImage(id); };
      let failure: unknown;
      try { await h.run({ overlays: {}, images: [descriptor('pin')], styleOverrides: [] }); } catch (error) { failure = error; }
      expect((failure as Error | undefined)?.name).to.equal('MapResourceError');
      const uncertain = h.peer.images.get('pin'); expect(uncertain !== undefined && uncertain !== supplied).to.equal(true);
      const priorRemovals = removals;
      h.features.configureImageProvider(peer, undefined, h.owner);
      expect(removals).to.equal(priorRemovals); expect(h.peer.images.get('pin') === uncertain).to.equal(true);
    } finally { h.features.dispose(); }
  });
});


it('settles native image ownership before callback-queued cancellation cleanup starts', async () => {
  const h = await harness(); const addSource = h.peer.addSource.bind(h.peer);
  let successor!: Promise<void>; let queued!: () => void;
  const ready = new Promise<void>(resolve => { queued = resolve; });
  h.peer.addSource = (id, source) => {
    addSource(id, source); h.features.cancel();
    queueMicrotask(() => {
      successor = h.run({ overlays: {}, images: [], styleOverrides: [] });
      queued();
    });
  };
  const interrupted = h.run({ overlays, images: [], styleOverrides: [] }).catch(error => error as Error);
  try {
    await ready;
    const successorError = await successor.then(() => undefined, (error: unknown) => error);
    expect(successorError === undefined).to.equal(true);
    expect((await interrupted as Error).name).to.equal('AbortError');
    expect(h.peer.sources.size).to.equal(0);
    expect(h.peer.layers.has('icons')).to.equal(false);
  } finally { await interrupted; h.features.dispose(); }
});


describe('map mutable owned-layer adapter', () => {
  it('adapts all mutable layer setters without retiring opaque GeoJSON, image ownership or feature-state routes', async () => {
    const h = await harness(), states = new MapFeatureStateRoutes(); let reads = 0;
    const data = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, geometry: null,
      properties: Object.defineProperty({}, 'opaque', { enumerable: true, get() { reads++; throw new Error('opaque payload'); } }) }] };
    const writes: string[] = [], stateWrites: string[] = [], changes: MapOwnedSourceChange[] = [];
    const paint = h.peer.setPaintProperty.bind(h.peer), layout = h.peer.setLayoutProperty.bind(h.peer);
    h.peer.setPaintProperty = (id, name, value) => { writes.push(`paint:${name}`); paint(id, name, value); };
    h.peer.setLayoutProperty = (id, name, value) => { writes.push(`layout:${name}`); layout(id, name, value); };
    Object.assign(h.peer, {
      setFilter: (_id: string, value: unknown) => { writes.push(`filter:${JSON.stringify(value)}`); },
      setLayerZoomRange: (_id: string, min: number, max: number) => { writes.push(`zoom:${min}:${max}`); },
    });
    const input = (color: string, visibility: string, value: string, minzoom: number) => ({ overlays: {
      sources: [{ id: 'points', source: { type: 'geojson', data } }],
      layers: [{ layer: { id: 'dots', type: 'circle', source: 'points', paint: { 'circle-color': color },
        layout: { visibility }, filter: ['==', ['get', 'value'], value], minzoom, maxzoom: 20 } }],
    }, images: [descriptor()], styleOverrides: [] });
    const ctx = { ...h.context, beforeSourceChange: (change: MapOwnedSourceChange) => { changes.push(change); states.refreshNative('overlay', change.id); } };
    const run = (color: string, visibility: string, value: string, min: number) => h.features.reconcile(h.peer as unknown as MapLibreMapCapability, 1, input(color, visibility, value, min), ctx);
    const statePeer: MapFeatureStatePeer = { getSource: id => h.peer.getSource(id), setFeatureState: () => { stateWrites.push('set'); }, removeFeatureState: () => { stateWrites.push('remove'); } };
    try {
      await run('red', 'visible', 'old', 1);
      const source = h.peer.getSource('points'), layer = h.peer.getLayer('dots'), image = h.peer.images.get('pin');
      const route = { origin: 'overlay', source: 'points', nativeSource: 'points', identity: data };
      const target = { origin: 'overlay', source: 'points', id: 1 };
      states.configure([route]); states.set(target, { selected: true }); states.replay(statePeer, 1); h.peer.calls.length = 0;
      await run('blue', 'none', 'new', 2); states.configure([route]); states.replay(statePeer, 1);
      expect(writes).to.deep.equal(['paint:circle-color', 'layout:visibility', 'filter:["==",["get","value"],"new"]', 'zoom:2:20']);
      expect(h.peer.calls).to.deep.equal(['repaint']); expect(changes).to.deep.equal([]); expect(reads).to.equal(0);
      expect(h.peer.getSource('points') === source).to.equal(true); expect(h.peer.getLayer('dots') === layer).to.equal(true);
      expect(h.peer.images.get('pin') === image).to.equal(true); expect(h.prepare.calls).to.equal(1); expect(h.prepare.disposals).to.equal(0);
      expect(states.get(target)).to.deep.equal({ selected: true }); expect(stateWrites).to.deep.equal(['set']);
    } finally { states.dispose(); h.features.dispose(); }
  });
  it('does not invoke a native setter accessor when deciding whether to retain a layer', async () => {
    const h = await harness(); let reads = 0;
    Object.defineProperty(h.peer, 'setFilter', { get() { reads++; throw new Error('native accessor'); } });
    const data = { type: 'FeatureCollection', features: [] };
    const input = (filter: unknown) => ({ overlays: { sources: [{ id: 'points', source: { type: 'geojson', data } }],
      layers: [{ layer: { id: 'dots', type: 'circle', source: 'points', filter } }] }, images: [], styleOverrides: [] });
    try {
      await h.run(input(['has', 'first'])); const source = h.peer.getSource('points'), layer = h.peer.getLayer('dots'); h.peer.calls.length = 0;
      await h.run(input(['has', 'second'])); expect(reads).to.equal(0);
      expect(h.peer.getSource('points') === source).to.equal(true); expect(h.peer.getLayer('dots') === layer).to.equal(false);
      expect(h.peer.calls).to.deep.equal(['layer-dots', 'layer+dots']);
    } finally { h.features.dispose(); }
  });
  it('sanitizes mutable setter failure while keeping restored native identity and the owned-image lease', async () => {
    const h = await harness(), data = { type: 'FeatureCollection', features: [] };
    const paint = h.peer.setPaintProperty.bind(h.peer);
    h.peer.setPaintProperty = (id, name, value) => { paint(id, name, value); if (value === 'blue') throw new Error('private mutable detail'); };
    const input = (color: string) => ({ overlays: { sources: [{ id: 'points', source: { type: 'geojson', data } }],
      layers: [{ layer: { id: 'dots', type: 'circle', source: 'points', paint: { 'circle-color': color } } }] }, images: [descriptor()], styleOverrides: [] });
    try {
      await h.run(input('red')); const source = h.peer.getSource('points'), layer = h.peer.getLayer('dots'), image = h.peer.images.get('pin');
      let message = ''; try { await h.run(input('blue')); } catch (error) { message = String(error); }
      expect(message).not.to.equal(''); expect(message.includes('private mutable detail')).to.equal(false);
      expect(h.peer.getSource('points') === source).to.equal(true); expect(h.peer.getLayer('dots') === layer).to.equal(true);
      expect(h.peer.getPaintProperty('dots', 'circle-color')).to.equal('red'); expect(h.peer.images.get('pin') === image).to.equal(true);
      expect(h.prepare.disposals).to.equal(0);
    } finally { h.features.dispose(); }
  });

});

describe('map native source option ownership', () => {
  for (const throwsAfterMutation of [false, true]) {
    it(`keeps mutable native image options separate from admitted source journals (throw after mutation=${throwsAfterMutation})`, async () => {
      const h = await harness();
      const data = { type: 'FeatureCollection', features: [] };
      const originalAddSource = h.peer.addSource.bind(h.peer);
      const installed: Record<string, unknown>[] = [], changes: MapOwnedSourceChange[] = [];
      let rejectUpdate = false, writes = 0;
      h.peer.addSource = (id, value) => {
        originalAddSource(id, value);
        const options = value as Record<string, unknown>;
        if (options['type'] !== 'image') return;
        installed.push(options);
        h.peer.sources.set(id, {
          updateImage(next: { url: string; coordinates: unknown }) {
            options['url'] = next.url; writes++;
            if (rejectUpdate) { rejectUpdate = false; throw new Error('image update failed after mutation'); }
          },
        });
      };
      const input = (url: string) => ({ overlays: {
        sources: [{ id: 'coverage', source: { type: 'image', url,
          coordinates: [[-1, 1], [1, 1], [1, -1], [-1, -1]] } },
          { id: 'points', source: { type: 'geojson', data } }],
        layers: [{ layer: { id: 'coverage-layer', type: 'raster', source: 'coverage' } }],
      }, images: [], styleOverrides: [] });
      const original = input('https://example.test/a.png'), changed = input('https://example.test/b.png');
      const ctx = { ...h.context, beforeSourceChange: (change: MapOwnedSourceChange) => { changes.push(change); } };
      const run = (value: ReturnType<typeof input>, style = 1) =>
        h.features.reconcile(h.peer as unknown as MapLibreMapCapability, style, value, ctx);
      try {
        await run(original);
        expect((h.peer.getSource('points') as Record<string, unknown>)['data'] === data).to.equal(true);
        const source = h.peer.getSource('coverage'), layer = h.peer.getLayer('coverage-layer');
        rejectUpdate = throwsAfterMutation;
        let rejected = false;
        try { await run(changed); } catch { rejected = true; }
        expect(rejected).to.equal(throwsAfterMutation);
        expect(writes).to.equal(1);
        expect(installed[0]!['url']).to.equal('https://example.test/b.png');
        expect(Object.isFrozen(installed[0])).to.equal(false);
        expect(original.overlays.sources[0]!.source.url).to.equal('https://example.test/a.png');
        expect(changes[0]!.previous?.['url']).to.equal('https://example.test/a.png');
        expect(Object.isFrozen(changes[0]!.previous)).to.equal(true);
        expect(installed[0] === changes[0]!.previous).to.equal(false);
        if (throwsAfterMutation) {
          expect(changes.map(({ id, reason }) => ({ id, reason }))).to.deep.equal([
            { id: 'coverage', reason: 'update' },
            { id: 'coverage', reason: 'rollback' },
            { id: 'points', reason: 'rollback' },
          ]);
          expect(installed).to.have.length(2);
          expect(installed[1]!['url']).to.equal('https://example.test/a.png');
          expect(h.peer.getSource('coverage') === source).to.equal(false);
          await run(changed);
          expect(writes).to.equal(2);
        } else {
          expect(h.peer.getSource('coverage') === source).to.equal(true);
          expect(h.peer.getLayer('coverage-layer') === layer).to.equal(true);
        }
        const current = h.peer.getSource('coverage'), totalWrites = writes;
        await run(changed);
        expect(writes).to.equal(totalWrites); expect(h.peer.getSource('coverage') === current).to.equal(true);
        h.peer.sources.clear(); h.peer.layers.clear(); h.peer.order = [];
        await run(changed, 2);
        expect((h.peer.getSource('points') as Record<string, unknown>)['data'] === data).to.equal(true);
        expect(installed.at(-1)!['url']).to.equal('https://example.test/b.png');
        expect(installed.at(-1) === installed[0]).to.equal(false);
        expect(writes).to.equal(totalWrites);
      } finally { h.features.dispose(); }
    });
  }
});
