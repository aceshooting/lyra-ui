import { expect, fixture, html, waitUntil } from '@open-wc/testing';
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

  it('skips native preparation and writes for structurally equal admitted resource assignments', async () => {
    const h = await harness(); const input = { overlays, images: [descriptor()], styleOverrides: [] };
    await h.run(input); const preparations = h.peer.requirements.length; h.peer.calls.length = 0;
    await h.run({ overlays: structuredClone(overlays), images: [descriptor()], styleOverrides: [] });
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
