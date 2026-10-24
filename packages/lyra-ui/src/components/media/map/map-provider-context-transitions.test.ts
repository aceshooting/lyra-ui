import { expect, fixture, html } from '@open-wc/testing';
import type { LyraMapImage } from './map-image-admission.js';
import { MapImageProvider, type MapImageProviderContext } from './map-image-provider.js';
import type { prepareMapImages, PreparedMapImage } from './map-images.js';
import type { MapLibreMapCapability } from './map-loader.js';

type Resolver = (id: string) => void | Promise<void>;
class AtlasPeer {
  readonly images = new Map<string, ImageData>();
  readonly additions: string[] = [];
  readonly removals: string[] = [];
  resolver: Resolver | null = null;
  installations = 0;
  afterAdd?: (id: string) => void;
  hasImage(id: string): boolean { return this.images.has(id); }
  addImage(id: string, image: ImageData): void {
    this.images.set(id, image); this.additions.push(id); this.afterAdd?.(id);
  }
  removeImage(id: string): void { this.images.delete(id); this.removals.push(id); }
  setMissingStyleImageResolver(resolver: Resolver | null): void {
    this.resolver = resolver; if (resolver) this.installations++;
  }
}
const asMap = (map: AtlasPeer) => map as unknown as MapLibreMapCapability;
const descriptor = (id: string): LyraMapImage => ({ id, width: 4, height: 4, pixelRatio: 1,
  source: { kind: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' } });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function context(existingOwner?: Element) {
  const owner = existingOwner ?? await fixture<HTMLElement>(html`<div></div>`);
  const owned = new Set<string>(), prepared: string[] = [], disposed: string[] = [];
  const prepare: typeof prepareMapImages = async value => {
    const rows = value as readonly LyraMapImage[];
    const images = rows.map((row): PreparedMapImage => {
      prepared.push(row.id);
      let pixels: ImageData | null = new ImageData(row.width, row.height);
      return { id: row.id, width: row.width, height: row.height, pixelRatio: row.pixelRatio,
        encodedBytes: 64, decodedPixels: row.width * row.height,
        get image() { return pixels; },
        dispose() { disposed.push(row.id); pixels = null; } };
    });
    return { ok: true, images, dispose() { for (const image of images) image.dispose(); } };
  };
  const value: MapImageProviderContext = { owner, prepare, ownedIds: () => owned,
    ownedUsage: () => ({ count: owned.size, encodedBytes: 0, decodedPixels: 0 }) };
  return { value, owned, prepared, disposed };
}
function aborted(run: () => void): void {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).to.be.instanceOf(DOMException);
  expect((caught as DOMException).name).to.equal('AbortError');
}

describe('map image provider context transitions', () => {
  it('restores a cancelled declarative reservation before refreshing the same provider context', async () => {
    const first = await context(), next = await context(first.value.owner);
    const map = new AtlasPeer(), provider = new MapImageProvider(), asked: string[] = [];
    const supply = (id: string) => { asked.push(id); return descriptor(id); };
    provider.configure(asMap(map), supply, first.value);
    try {
      await map.resolver!('retained');
      const retained = map.images.get('retained'), resolver = map.resolver;
      const update = provider.beginOwnedUpdate(['retained']); update.detach();
      expect(map.images.size).to.equal(0);
      next.owned.add('declared');
      provider.configure(asMap(map), supply, next.value);
      expect(map.images.get('retained') === retained).to.equal(true);
      expect(map.resolver === resolver).to.equal(true); expect(map.installations).to.equal(1);
      expect(first.disposed).to.deep.equal([]);
      aborted(() => update.commit());
      expect(update.budget({ count: 0, encodedBytes: 0, decodedPixels: 0 })).to.equal(false);
      await map.resolver!('retained'); await map.resolver!('declared'); await map.resolver!('fresh');
      expect(asked).to.deep.equal(['retained', 'fresh']);
      expect(first.prepared).to.deep.equal(['retained']); expect(next.prepared).to.deep.equal(['fresh']);
      expect([...map.images.keys()]).to.deep.equal(['retained', 'fresh']);
      provider.reset();
      expect(first.disposed).to.deep.equal(['retained']); expect(next.disposed).to.deep.equal(['fresh']);
      expect(map.images.size).to.equal(0); expect(map.resolver).to.equal(null);
    } finally { provider.dispose(); }
  });

  it('disposes preparation from an obsolete context and retries the same ID with the refreshed context', async () => {
    const first = await context(), next = await context(first.value.owner);
    const map = new AtlasPeer(), provider = new MapImageProvider(), entered = deferred(), release = deferred();
    const asked: string[] = [];
    const supply = (id: string) => { asked.push(id); return descriptor(id); };
    const prepare: typeof prepareMapImages = async (value, input) => {
      const result = await first.value.prepare(value, input);
      entered.resolve(); await release.promise; return result;
    };
    provider.configure(asMap(map), supply, { ...first.value, prepare });
    const resolver = map.resolver!, pending = Promise.resolve(resolver('pin'));
    try {
      await entered.promise;
      provider.configure(asMap(map), supply, next.value);
      release.resolve(); await pending;
      expect(first.disposed).to.deep.equal(['pin']);
      expect(map.images.size).to.equal(0); expect(provider.ids.size).to.equal(0);
      expect(map.resolver === resolver).to.equal(true); expect(map.installations).to.equal(1);
      await map.resolver!('pin');
      expect(asked).to.deep.equal(['pin', 'pin']); expect(next.prepared).to.deep.equal(['pin']);
      expect(map.images.has('pin')).to.equal(true);
      provider.reset();
      expect(first.disposed).to.deep.equal(['pin']); expect(next.disposed).to.deep.equal(['pin']);
    } finally { release.resolve(); await pending; provider.dispose(); }
  });

  it('keeps a successor provider configured by native restoration instead of overwriting it with the outer context refresh', async () => {
    const first = await context(), obsolete = await context(first.value.owner), successor = await context(first.value.owner);
    const map = new AtlasPeer(), provider = new MapImageProvider();
    const supply = (id: string) => descriptor(id);
    const nextSupply = (id: string) => descriptor(id);
    provider.configure(asMap(map), supply, first.value);
    try {
      await map.resolver!('a'); await map.resolver!('b');
      const update = provider.beginOwnedUpdate(['a', 'b']); update.detach();
      map.afterAdd = id => {
        if (id !== 'a') return;
        map.afterAdd = undefined;
        provider.configure(asMap(map), nextSupply, successor.value);
      };
      provider.configure(asMap(map), supply, obsolete.value);
      expect(map.additions).to.deep.equal(['a', 'b', 'a']);
      expect(map.removals).to.deep.equal(['a', 'b', 'a']);
      expect(map.images.size).to.equal(0); expect(provider.ids.size).to.equal(0);
      expect(first.disposed).to.deep.equal(['a', 'b']); expect(map.installations).to.equal(2);
      aborted(() => update.commit());
      await map.resolver!('successor');
      expect(obsolete.prepared).to.deep.equal([]); expect(successor.prepared).to.deep.equal(['successor']);
      expect([...map.images.keys()]).to.deep.equal(['successor']);
      provider.reset();
      expect(first.disposed).to.deep.equal(['a', 'b']); expect(successor.disposed).to.deep.equal(['successor']);
    } finally { map.afterAdd = undefined; provider.dispose(); }
  });

  it('restores only provider-owned slots when a declarative image has taken over another detached slot', async () => {
    const item = await context(), map = new AtlasPeer(), provider = new MapImageProvider();
    provider.configure(asMap(map), descriptor, item.value);
    try {
      await map.resolver!('a'); await map.resolver!('b');
      const retained = map.images.get('b');
      const update = provider.beginOwnedUpdate(['a', 'b']); update.detach();
      const declared = new ImageData(4, 4); item.owned.add('a'); map.addImage('a', declared);
      expect(update.rollback()).to.equal(true);
      expect(map.images.get('a') === declared).to.equal(true);
      expect(map.images.get('b') === retained).to.equal(true);
      expect(map.additions).to.deep.equal(['a', 'b', 'a', 'b']);
      expect(item.disposed).to.deep.equal([]);
      provider.reset();
      expect(map.images.get('a') === declared).to.equal(true); expect(map.images.has('b')).to.equal(false);
      expect(map.removals).to.deep.equal(['a', 'b', 'b']);
      expect(item.disposed).to.deep.equal(['a', 'b']); expect(provider.ids.size).to.equal(0);
    } finally { provider.dispose(); }
  });
});
