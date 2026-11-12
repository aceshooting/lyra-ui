import { expect, fixture, html } from '@open-wc/testing';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import { MAP_IMAGE_LIMITS, type LyraMapImage } from './map-image-admission.js';
import { MapImageProvider, type MapImageProviderContext } from './map-image-provider.js';
import type { prepareMapImages, PreparedMapImage } from './map-images.js';
import type { MapLibreMapCapability } from './map-loader.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>';
const descriptor = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, source: { kind: 'svg', markup: svg }, width: 4, height: 4, pixelRatio: 2, ...extra }) as LyraMapImage;

/** An engine with the 6.x missing-image hook, or (`hook: false`) only the legacy event. */
class ProviderMap {
  readonly images = new Map<string, { readonly image: ImageData; readonly options: unknown }>();
  readonly listeners = new Set<(event: { id: string }) => void>();
  resolver: ((id: string) => void | Promise<void>) | null = null;
  constructor(hook = true) { if (!hook) (this as { setMissingStyleImageResolver?: unknown }).setMissingStyleImageResolver = undefined; }
  hasImage(id: string): boolean { return this.images.has(id); }
  addImage(id: string, image: ImageData, options: unknown): void { this.images.set(id, { image, options }); }
  removeImage(id: string): void { this.images.delete(id); }
  setMissingStyleImageResolver(resolver: ((id: string) => void | Promise<void>) | null): void { this.resolver = resolver; }
  on(_type: string, listener: (event: { id: string }) => void): void { this.listeners.add(listener); }
  off(_type: string, listener: (event: { id: string }) => void): void { this.listeners.delete(listener); }
}
const asMap = (map: ProviderMap) => map as unknown as MapLibreMapCapability;

async function harness(owned: readonly string[] = [], usage = { count: 0, encodedBytes: 0, decodedPixels: 0 }) {
  const owner = await fixture<HTMLElement>(html`<div></div>`);
  const prepared: string[] = []; let disposed = 0;
  const prepare: typeof prepareMapImages = async (value) => {
    const rows = value as readonly LyraMapImage[];
    prepared.push(...rows.map(row => row.id));
    const images = rows.map((row): PreparedMapImage => ({ id: row.id, width: row.width, height: row.height, pixelRatio: row.pixelRatio,
      ...(row.sdf ? { sdf: true } : {}), encodedBytes: 64, decodedPixels: row.width * row.height,
      image: new ImageData(row.width, row.height), dispose() { disposed += 1; } }));
    return { ok: true, images, dispose() {} };
  };
  const context: MapImageProviderContext = { owner, prepare, ownedIds: () => new Set(owned), ownedUsage: () => usage };
  return { owner, context, prepared, get disposed() { return disposed; } };
}

describe('map lazy image provider', () => {
  it('supplies a missing image once, with its options, and re-adds kept pixels after a style swap', async () => {
    const { context, prepared } = await harness(); const map = new ProviderMap(); const asked: string[] = [];
    const provider = new MapImageProvider();
    provider.configure(asMap(map), async (id: string) => { asked.push(id); return descriptor(id, { sdf: true }); }, context);
    expect(typeof map.resolver).to.equal('function');
    await map.resolver!('station');
    expect(map.images.get('station')!.options).to.deep.equal({ pixelRatio: 2, sdf: true });
    map.images.clear(); await map.resolver!('station');
    expect(map.images.has('station')).to.equal(true); expect(asked).to.deep.equal(['station']); expect(prepared).to.deep.equal(['station']);
    await Promise.all([map.resolver!('a'), map.resolver!('a')]);
    expect(asked).to.deep.equal(['station', 'a']); expect([...provider.ids].sort()).to.deep.equal(['a', 'station']);
  });

  it('leaves images owned by images alone and hands supplied copies over to them', async () => {
    const owned = new Set(['pin']); const { context } = await harness();
    const map = new ProviderMap(); const provider = new MapImageProvider(); const asked: string[] = [];
    provider.configure(asMap(map), (id: string) => { asked.push(id); return descriptor(id); }, { ...context, ownedIds: () => owned });
    await map.resolver!('pin'); expect(asked).to.deep.equal([]); expect(map.images.has('pin')).to.equal(false);
    await map.resolver!('flag'); expect(map.images.has('flag')).to.equal(true);
    provider.release(['flag', 'unrelated']); expect(map.images.has('flag')).to.equal(false); expect(provider.ids.size).to.equal(0);
  });

  it('keeps declined, invalid, failing and over-budget images missing without asking again', async () => {
    const { context } = await harness([], { count: MAP_IMAGE_LIMITS.count - 1, encodedBytes: 0, decodedPixels: 0 });
    const map = new ProviderMap(); const provider = new MapImageProvider(); const asked: string[] = [];
    const warnings = await captureDevWarnings(async () => {
      provider.configure(asMap(map), (id: string) => {
        asked.push(id);
        if (id === 'none') return undefined;
        if (id === 'wrong') return descriptor('other');
        if (id === 'throws') throw new Error('private');
        return descriptor(id);
      }, context);
      for (const id of ['none', 'wrong', 'throws', 'first', 'second']) await map.resolver!(id);
      for (const id of ['none', 'wrong', 'throws', 'second']) await map.resolver!(id);
    });
    expect([...map.images.keys()]).to.deep.equal(['first']);
    expect(asked).to.deep.equal(['none', 'wrong', 'throws', 'first', 'second']);
    expect(warnings.length).to.equal(4); expect(warnings.join(' ')).not.to.include('private');
  });

  it('removes supplied images and uninstalls the hook when the provider changes or is cleared', async () => {
    const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    await map.resolver!('one'); expect(map.images.has('one')).to.equal(true);
    const next = (id: string) => descriptor(id, { pixelRatio: 1 });
    provider.configure(asMap(map), next, context);
    expect(map.images.has('one')).to.equal(false); await map.resolver!('one');
    expect(map.images.get('one')!.options).to.deep.equal({ pixelRatio: 1 });
    provider.configure(asMap(map), undefined, context);
    expect(map.resolver).to.equal(null); expect(map.images.size).to.equal(0);
  });

  it('falls back to the styleimagemissing event on an engine without the resolver hook', async () => {
    const { context } = await harness(); const map = new ProviderMap(false); const provider = new MapImageProvider();
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    expect(map.listeners.size).to.equal(1);
    for (const listener of map.listeners) listener({ id: 'late' });
    await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0));
    expect(map.images.has('late')).to.equal(true);
    provider.dispose(); expect(map.listeners.size).to.equal(0);
  });

  it('drops work that resolves after the owner disconnects or the provider is replaced', async () => {
    const { context, owner } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    let release!: (value: LyraMapImage) => void;
    provider.configure(asMap(map), () => new Promise<LyraMapImage>(resolve => { release = resolve; }), context);
    const pending = map.resolver!('slow'); const resolver = map.resolver!;
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    release(descriptor('slow')); await pending;
    expect(map.images.has('slow')).to.equal(false);
    owner.remove(); await resolver('other'); await map.resolver!('other'); expect(map.images.size).to.equal(0);
  });
});


describe('map provider declarative ownership transactions', () => {
  it('does not retain or remove a declarative successor when old provider work settles after takeover', async () => {
    const owned = new Set<string>(); const { context } = await harness(); const map = new ProviderMap();
    const provider = new MapImageProvider(); let release!: (image: LyraMapImage) => void;
    provider.configure(asMap(map), () => new Promise<LyraMapImage>(resolve => { release = resolve; }),
      { ...context, ownedIds: () => owned });
    const pending = map.resolver!('pin');
    // Reproduce the public handover window without relying on a new transaction API.
    provider.release(['pin']); owned.add('pin');
    const declared = new ImageData(1, 1); map.addImage('pin', declared, { pixelRatio: 1 });
    release(descriptor('pin')); await pending;
    expect(provider.ids.has('pin')).to.equal(false);
    provider.reset();
    expect(map.images.get('pin')?.image === declared).to.equal(true);
  });

  it('disposes prepared provider pixels that finish after declarative takeover', async () => {
    const owned = new Set<string>(); const { context } = await harness(); const map = new ProviderMap();
    const provider = new MapImageProvider(); let release!: () => void; let entered!: () => void;
    const preparing = new Promise<void>(resolve => { entered = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    let disposals = 0;
    const prepare: typeof prepareMapImages = async () => {
      entered(); await barrier;
      return { ok: true, images: [{ id: 'pin', width: 1, height: 1, pixelRatio: 1,
        encodedBytes: 1, decodedPixels: 1, image: new ImageData(1, 1), dispose() { disposals += 1; } }], dispose() {} };
    };
    provider.configure(asMap(map), () => descriptor('pin'), { ...context, prepare, ownedIds: () => owned });
    const pending = map.resolver!('pin'); await preparing;
    provider.release(['pin']); owned.add('pin');
    const declared = new ImageData(1, 1); map.addImage('pin', declared, { pixelRatio: 1 });
    release(); await pending;
    expect(disposals).to.equal(1); expect(provider.ids.size).to.equal(0);
    provider.reset(); expect(map.images.get('pin')?.image === declared).to.equal(true);
  });
});

it('keeps a successor provider request pending when an older request finishes', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  const releases: ((value: LyraMapImage) => void)[] = [];
  provider.configure(asMap(map), () => new Promise<LyraMapImage>(resolve => { releases.push(resolve); }), context);
  try {
    const old = map.resolver!('pin'); provider.release(['pin']);
    const successor = map.resolver!('pin');
    expect(releases.length).to.equal(2);
    releases[0]!(descriptor('pin')); await old;
    const duplicate = map.resolver!('pin'); expect(releases.length).to.equal(2);
    releases[1]!(descriptor('pin')); await successor; await duplicate;
    expect(provider.ids.size).to.equal(1); expect(map.images.has('pin')).to.equal(true);
  } finally { provider.dispose(); }
});

for (const usage of [
  { count: MAP_IMAGE_LIMITS.count, encodedBytes: 0, decodedPixels: 0 },
  { count: 1, encodedBytes: MAP_IMAGE_LIMITS.totalBytes, decodedPixels: 1 },
  { count: 1, encodedBytes: 1, decodedPixels: MAP_IMAGE_LIMITS.totalPixels },
]) {
  it(`rejects provider growth beyond existing declarative usage ${JSON.stringify(usage)}`, async () => {
    const { context } = await harness([], usage); const map = new ProviderMap(); const provider = new MapImageProvider();
    try {
      provider.configure(asMap(map), (id: string) => descriptor(id), context);
      await captureDevWarnings(async () => { await map.resolver!('extra'); });
      expect(provider.ids.size).to.equal(0); expect(map.images.size).to.equal(0);
    } finally { provider.dispose(); }
  });
}


describe('map provider synchronous ownership boundaries', () => {
  it('does not install after a native occupancy probe resets the provider', async () => {
    const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    const hasImage = map.hasImage.bind(map); let probes = 0, additions = 0;
    const addImage = map.addImage.bind(map);
    map.hasImage = id => { if (++probes === 2) provider.reset(); return hasImage(id); };
    map.addImage = (id, image, options) => { additions += 1; addImage(id, image, options); };
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    try { await map.resolver!('pin'); expect(additions).to.equal(0); expect(provider.ids.size).to.equal(0); }
    finally { provider.dispose(); }
  });

  it('rejects a successor during restoration and restores every displaced image', async () => {
    const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    try {
      await map.resolver!('a'); await map.resolver!('b');
      const a = map.images.get('a')?.image, b = map.images.get('b')?.image;
      const first = provider.beginOwnedUpdate(['a', 'b']); first.detach();
      const addImage = map.addImage.bind(map); let successorFailure: unknown; let once = true;
      map.addImage = (id, image, options) => {
        addImage(id, image, options);
        if (once) {
          once = false;
          try { provider.beginOwnedUpdate(['successor']); } catch (error) { successorFailure = error; }
        }
      };
      expect(first.rollback()).to.equal(true);
      expect((successorFailure as Error | undefined)?.name).to.equal('AbortError');
      expect(map.images.get('a')?.image === a).to.equal(true);
      expect(map.images.get('b')?.image === b).to.equal(true);
    } finally { provider.dispose(); }
  });

  it('reports restoration failure without claiming an occupied or rejected native slot', async () => {
    const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    try {
      await map.resolver!('pin'); const update = provider.beginOwnedUpdate(['pin']); update.detach();
      map.addImage = () => { throw new Error('Native restoration rejected'); };
      expect(update.rollback()).to.equal(false); expect(map.images.has('pin')).to.equal(false);
    } finally { provider.dispose(); }
  });

  for (const usage of [
    { count: MAP_IMAGE_LIMITS.count, encodedBytes: 0, decodedPixels: 0 },
    { count: 1, encodedBytes: MAP_IMAGE_LIMITS.totalBytes, decodedPixels: 1 },
    { count: 1, encodedBytes: 1, decodedPixels: MAP_IMAGE_LIMITS.totalPixels },
  ]) {
    it(`bounds new provider work against measured pending declarations ${JSON.stringify(usage)}`, async () => {
      const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
      provider.configure(asMap(map), (id: string) => descriptor(id), context);
      const update = provider.beginOwnedUpdate([]);
      try {
        expect(update.budget(usage)).to.equal(true);
        await captureDevWarnings(async () => { await map.resolver!('extra'); });
        expect(provider.ids.size).to.equal(0); expect(map.images.size).to.equal(0);
      } finally { update.rollback(); provider.dispose(); }
    });
  }

  it('can reject an unmeasured proposal after provider growth without removing the accepted image', async () => {
    const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    const update = provider.beginOwnedUpdate([]);
    try {
      await map.resolver!('extra'); const image = map.images.get('extra');
      expect(update.budget({ count: MAP_IMAGE_LIMITS.count, encodedBytes: 0, decodedPixels: 0 })).to.equal(false);
      update.rollback(); expect(map.images.get('extra') === image).to.equal(true);
    } finally { provider.dispose(); }
  });
});


it('rejects a successor reservation during native detach and restores the retained image', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  provider.configure(asMap(map), (id: string) => descriptor(id), context);
  try {
    await map.resolver!('pin'); const retained = map.images.get('pin');
    const update = provider.beginOwnedUpdate(['pin']); const removeImage = map.removeImage.bind(map);
    let successorFailure: unknown;
    map.removeImage = id => {
      removeImage(id);
      try { provider.beginOwnedUpdate(['other']); } catch (error) { successorFailure = error; }
    };
    let failure: unknown;
    try { update.detach(); } catch (error) { failure = error; }
    expect((successorFailure as Error | undefined)?.name).to.equal('AbortError');
    expect((failure as Error | undefined)?.name).to.equal('AbortError');
    expect(map.images.get('pin')?.image === retained?.image).to.equal(true);
  } finally { provider.dispose(); }
});

it('removes its native installation when addImage synchronously resets the provider', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  const addImage = map.addImage.bind(map);
  map.addImage = (id, image, options) => { addImage(id, image, options); provider.reset(); };
  provider.configure(asMap(map), (id: string) => descriptor(id), context);
  try {
    await map.resolver!('pin');
    expect(map.images.has('pin')).to.equal(false); expect(provider.ids.size).to.equal(0);
  } finally { provider.dispose(); }
});


it('cleans up an attempted installation that mutates before throwing', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  const addImage = map.addImage.bind(map);
  map.addImage = (id, image, options) => { addImage(id, image, options); throw new Error('Native add failed after mutation'); };
  provider.configure(asMap(map), (id: string) => descriptor(id), context);
  try {
    await map.resolver!('pin'); expect(map.images.has('pin')).to.equal(true);
    provider.reset(); expect(map.images.has('pin')).to.equal(false); expect(provider.ids.size).to.equal(0);
  } finally { provider.dispose(); }
});


it('finishes old atlas cleanup before same-map configuration from the uninstall callback', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  provider.configure(asMap(map), (id: string) => descriptor(id), context);
  try {
    await map.resolver!('old');
    const setResolver = map.setMissingStyleImageResolver.bind(map); let once = true; let requests = 0;
    map.setMissingStyleImageResolver = resolver => {
      setResolver(resolver);
      if (resolver === null && once) {
        once = false;
        provider.configure(asMap(map), (id: string) => { requests += 1; return descriptor(id); }, context);
      }
    };
    provider.reset();
    expect(map.images.has('old')).to.equal(false);
    await map.resolver!('old');
    expect(requests).to.equal(1); expect(map.images.has('old')).to.equal(true);
  } finally { provider.dispose(); }
});

it('drops deferred configuration when the engine is disposed during uninstall', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  provider.configure(asMap(map), (id: string) => descriptor(id), context);
  try {
    await map.resolver!('old');
    const setResolver = map.setMissingStyleImageResolver.bind(map); let once = true; let installations = 0, removals = 0;
    map.removeImage = () => { removals += 1; };
    map.setMissingStyleImageResolver = resolver => {
      setResolver(resolver);
      if (resolver !== null) installations += 1;
      if (resolver === null && once) {
        once = false;
        provider.configure(asMap(map), (id: string) => descriptor(id), context);
        provider.dispose();
      }
    };
    provider.reset();
    expect(installations).to.equal(0); expect(removals).to.equal(0);
    expect(map.resolver === null).to.equal(true); expect(provider.ids.size).to.equal(0);
  } finally { provider.dispose(); }
});


it('does not configure a removed engine from a top-level disposal callback', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  provider.configure(asMap(map), (id: string) => descriptor(id), context);
  await map.resolver!('old');
  const setResolver = map.setMissingStyleImageResolver.bind(map); let once = true; let installations = 0;
  map.setMissingStyleImageResolver = resolver => {
    setResolver(resolver);
    if (resolver !== null) installations += 1;
    if (resolver === null && once) {
      once = false;
      provider.configure(asMap(map), (id: string) => descriptor(id), context);
    }
  };
  provider.dispose();
  expect(installations).to.equal(0); expect(map.resolver === null).to.equal(true);
  expect(provider.ids.size).to.equal(0);
});

for (const hook of [true, false]) {
  it(`releases all pixels when the ${hook ? 'resolver' : 'event'} uninstall fails and revokes the old callback`, async () => {
    const h = await harness(); const map = new ProviderMap(hook); const provider = new MapImageProvider();
    let requests = 0;
    provider.configure(asMap(map), (id: string) => { requests += 1; return descriptor(id); }, h.context);
    const resolve = map.resolver;
    const listener = [...map.listeners][0];
    const request = async (id: string) => {
      if (resolve) await resolve(id);
      else { listener!({ id }); await new Promise(done => setTimeout(done, 0)); }
    };
    try {
      await request('a'); await request('b');
      expect(map.images.size).to.equal(2);
      map.setMissingStyleImageResolver = () => { throw new Error('Engine removed'); };
      map.off = () => { throw new Error('Engine removed'); };
      expect(() => provider.reset()).not.to.throw();
      expect(h.disposed).to.equal(2); expect(map.images.size).to.equal(0);
      await request('obsolete');
      expect(requests).to.equal(2); expect(provider.ids.size).to.equal(0);
    } finally { provider.dispose(); }
  });
}

for (const boundary of ['ownership', 'occupancy', 'removal', 'pixels'] as const) {
  it(`finishes pixel disposal when the engine disappears during ${boundary} cleanup`, async () => {
    const h = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    const disposed: string[] = []; const removals: string[] = [];
    let cleaning = false;
    const once = () => { if (cleaning) { cleaning = false; provider.dispose(); } };
    const prepare: typeof prepareMapImages = async value => {
      const rows = value as readonly LyraMapImage[];
      return { ok: true, images: rows.map(row => ({ id: row.id, width: 1, height: 1, pixelRatio: 1,
        encodedBytes: 1, decodedPixels: 1, image: new ImageData(1, 1),
        dispose() { disposed.push(row.id); if (boundary === 'pixels') once(); },
      })), dispose() {} };
    };
    const context = { ...h.context, prepare, ownedIds: () => {
      if (boundary === 'ownership') once();
      return new Set<string>();
    } };
    const hasImage = map.hasImage.bind(map), removeImage = map.removeImage.bind(map);
    map.hasImage = id => { if (boundary === 'occupancy') once(); return hasImage(id); };
    map.removeImage = id => { removals.push(id); removeImage(id); if (boundary === 'removal') once(); };
    provider.configure(asMap(map), (id: string) => descriptor(id), context);
    try {
      await map.resolver!('a'); await map.resolver!('b'); await map.resolver!('c');
      cleaning = true;
      expect(() => provider.reset()).not.to.throw();
      expect(disposed.slice().sort()).to.deep.equal(['a', 'b', 'c']);
      expect(removals).to.deep.equal(boundary === 'ownership' || boundary === 'occupancy' ? [] : ['a']);
      expect(provider.ids.size).to.equal(0);
      const successor = new ProviderMap();
      provider.configure(asMap(successor), (id: string) => descriptor(id), h.context);
      await successor.resolver!('fresh');
      expect([...successor.images.keys()]).to.deep.equal(['fresh']);
    } finally { provider.dispose(); }
  });
}

it('restores a retained provider image when declarative handover fails after native removal', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  provider.configure(asMap(map), (id: string) => descriptor(id), context);
  const removeImage = map.removeImage.bind(map);
  try {
    await map.resolver!('pin'); const original = map.images.get('pin')!.image;
    map.removeImage = id => { removeImage(id); throw new Error('Native removal failed after mutation'); };
    expect(() => provider.release(['pin'])).to.throw('Native removal failed after mutation');
    expect(map.images.get('pin')?.image === original).to.equal(true);
    expect([...provider.ids]).to.deep.equal(['pin']);
    map.removeImage = removeImage;
    provider.release(['pin']);
    expect(map.images.has('pin')).to.equal(false); expect(provider.ids.size).to.equal(0);
    await map.resolver!('replacement');
    expect(map.images.has('replacement')).to.equal(true);
  } finally { map.removeImage = removeImage; provider.dispose(); }
});

it('contains a failed native occupancy query and retries when the engine recovers', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  let calls = 0;
  provider.configure(asMap(map), (id: string) => { calls += 1; return descriptor(id); }, context);
  const hasImage = map.hasImage.bind(map);
  try {
    map.hasImage = () => { throw new Error('Atlas unavailable'); };
    await map.resolver!('pin');
    expect(calls).to.equal(0); expect(provider.ids.size).to.equal(0);
    map.hasImage = hasImage;
    await map.resolver!('pin');
    expect(calls).to.equal(1); expect(map.images.has('pin')).to.equal(true);
  } finally { map.hasImage = hasImage; provider.dispose(); }
});

it('rechecks measured bytes after concurrent preparation and disposes the over-budget result', async () => {
  const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
  const releases = new Map<string, () => void>(); const disposed: string[] = [];
  const prepare: typeof prepareMapImages = value => {
    const id = (value as readonly LyraMapImage[])[0]!.id;
    return new Promise(resolve => { releases.set(id, () => resolve({ ok: true,
      images: [{ id, width: 1, height: 1, pixelRatio: 1, encodedBytes: Math.ceil(MAP_IMAGE_LIMITS.totalBytes * 0.75),
        decodedPixels: 1, image: new ImageData(1, 1), dispose() { disposed.push(id); } }], dispose() {},
    })); });
  };
  provider.configure(asMap(map), (id: string) => descriptor(id), { ...context, prepare });
  try {
    const a = map.resolver!('a'), b = map.resolver!('b');
    await Promise.resolve();
    expect(releases.size).to.equal(2);
    releases.get('a')!(); await a;
    const warnings = await captureDevWarnings(async () => { releases.get('b')!(); await b; });
    expect(warnings.join(' ')).to.include('image budget');
    expect([...provider.ids]).to.deep.equal(['a']); expect([...map.images.keys()]).to.deep.equal(['a']);
    expect(disposed).to.deep.equal(['b']);
    provider.reset();
    expect(disposed).to.deep.equal(['b', 'a']);
  } finally { provider.dispose(); }
});

for (const missing of ['encodedBytes', 'decodedPixels'] as const) {
  it(`charges a retained image with missing ${missing} against the entire budget`, async () => {
    const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    const disposed: string[] = [];
    const prepare: typeof prepareMapImages = async value => {
      const id = (value as readonly LyraMapImage[])[0]!.id;
      return { ok: true, images: [{ id, width: 1, height: 1, pixelRatio: 1,
        ...(missing === 'encodedBytes' ? { decodedPixels: 1 } : { encodedBytes: 1 }),
        image: new ImageData(1, 1), dispose() { disposed.push(id); } }], dispose() {} };
    };
    provider.configure(asMap(map), (id: string) => descriptor(id), { ...context, prepare });
    try {
      await map.resolver!('first');
      const warnings = await captureDevWarnings(async () => { await map.resolver!('second'); });
      expect(warnings.join(' ')).to.include('image budget');
      expect([...provider.ids]).to.deep.equal(['first']); expect([...map.images.keys()]).to.deep.equal(['first']);
      provider.reset();
      expect(disposed).to.include('first');
      expect(new Set(disposed).size).to.equal(disposed.length);
    } finally { provider.dispose(); }
  });
}

for (const pendingStage of ['provider', 'preparation'] as const) {
  it(`silences an obsolete ${pendingStage} failure without declining the replacement's ID`, async () => {
    const { context } = await harness(); const map = new ProviderMap(); const provider = new MapImageProvider();
    let reject!: (reason: unknown) => void;
    let finish!: () => void;
    const prepare: typeof prepareMapImages = () => new Promise(resolve => {
      finish = () => resolve({ ok: false, issue: { code: 'decode', id: 'pin' } });
    });
    const deferredProvider = () => new Promise<LyraMapImage>((_resolve, rejectPromise) => { reject = rejectPromise; });
    provider.configure(asMap(map), pendingStage === 'provider' ? deferredProvider : (id: string) => descriptor(id),
      pendingStage === 'preparation' ? { ...context, prepare } : context);
    try {
      const old = map.resolver!('pin'); await Promise.resolve();
      provider.configure(asMap(map), (id: string) => descriptor(id), context);
      const warnings = await captureDevWarnings(async () => {
        if (pendingStage === 'provider') reject(new Error('Obsolete provider failed'));
        else finish();
        await old;
      });
      expect(warnings).to.deep.equal([]);
      await map.resolver!('pin');
      expect([...provider.ids]).to.deep.equal(['pin']); expect(map.images.has('pin')).to.equal(true);
    } finally { provider.dispose(); }
  });
}

for (const retirement of ['reset', 'dispose'] as const) {
  it(`releases prepared and late pixels when preparation abort reenters ${retirement}`, async () => {
    const h = await harness();
    const map = new ProviderMap();
    const provider = new MapImageProvider();
    let aborts = 0, requests = 0, disposals = 0;
    let release!: () => void, entered!: () => void;
    const preparing = new Promise<void>(resolve => { entered = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    const prepare: typeof prepareMapImages = async (rows, options) => {
      const id = (rows as readonly LyraMapImage[])[0]!.id;
      if (id === 'pending') {
        options.signal!.addEventListener('abort', () => {
          aborts++;
          if (retirement === 'reset') provider.reset();
          else provider.dispose();
        }, { once: true });
        entered();
        await pending;
      }
      return { ok: true, images: [{ id, width: 1, height: 1, pixelRatio: 1,
        encodedBytes: 1, decodedPixels: 1, image: new ImageData(1, 1), dispose() { disposals++; },
      }], dispose() {} };
    };
    provider.configure(asMap(map), (id: string) => { requests++; return descriptor(id); }, { ...h.context, prepare });
    try {
      const resolve = map.resolver!;
      await resolve('ready');
      const work = resolve('pending');
      await preparing;
      provider.reset();
      expect(aborts).to.equal(1);
      expect(disposals).to.equal(1);
      expect(provider.ids.size).to.equal(0);
      release();
      await work;
      expect(disposals).to.equal(2);
      await resolve('obsolete');
      expect(requests).to.equal(2);
      expect(map.images.has('pending')).to.equal(false);
      if (retirement === 'reset') {
        expect(map.images.size).to.equal(0);
        expect(map.resolver === null).to.equal(true);
      }
      const successor = new ProviderMap();
      provider.configure(asMap(successor), (id: string) => descriptor(id), h.context);
      await successor.resolver!('fresh');
      expect([...successor.images.keys()]).to.deep.equal(['fresh']);
    } finally { release(); provider.dispose(); }
  });
}

it('disposes each prepared image once when pixel cleanup reenters provider disposal', async () => {
  const h = await harness();
  const map = new ProviderMap();
  const provider = new MapImageProvider();
  const released: string[] = [];
  const prepare: typeof prepareMapImages = async rows => {
    const id = (rows as readonly LyraMapImage[])[0]!.id;
    return { ok: true, images: [{ id, width: 1, height: 1, pixelRatio: 1,
      encodedBytes: 1, decodedPixels: 1, image: new ImageData(1, 1),
      dispose() { released.push(id); provider.dispose(); },
    }], dispose() {} };
  };
  provider.configure(asMap(map), (id: string) => descriptor(id), { ...h.context, prepare });
  await map.resolver!('first');
  await map.resolver!('second');
  provider.dispose();
  expect(released).to.deep.equal(['first', 'second']);
  expect(provider.ids.size).to.equal(0);
  expect(map.resolver === null).to.equal(true);
  provider.dispose();
  expect(released).to.deep.equal(['first', 'second']);
});
