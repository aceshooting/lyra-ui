import { expect, fixture, html } from '@open-wc/testing';
import { admitMapImages, MAP_IMAGE_LIMITS, prepareMapImages, type MapImagePreparationServices } from './map-images.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>';
const row = (id = 'icon') => ({ id, source: { kind: 'svg', markup: svg }, width: 8, height: 8, pixelRatio: 1 });
async function context() {
  const owner = await fixture<HTMLElement>(html`<div></div>`);
  const abort = new AbortController();
  return { owner, signal: abort.signal, isCurrent: () => true, abort };
}
const fakeServices = (onDispose: () => void = () => undefined): MapImagePreparationServices => ({
  loadSanitizer: () => Promise.resolve({ sanitize: (value: string) => value }),
  rasterize: async (input) => ({ image: new ImageData(input.width, input.height), dispose: onDispose }),
});

describe('map image descriptor admission', () => {
  it('copies and freezes known own data with stable trimmed ids', () => {
    const input = row(' icon ');
    const result = admitMapImages([input]);
    input.source.markup = 'changed';
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.images[0]!.id).to.equal('icon');
    expect(result.images[0]!.source.kind).to.equal('svg');
    expect(Object.isFrozen(result.images) && Object.isFrozen(result.images[0]!.source)).to.equal(true);
    expect(result.images[0]!.source).to.deep.equal({ kind: 'svg', markup: svg });
  });

  it('rejects duplicate ids, sparse/accessor rows and unsafe known fields without invoking them', () => {
    let reads = 0;
    const hostile = Object.defineProperty(row(), 'width', { get() { reads += 1; throw new Error('read'); } });
    const indexed: unknown[] = [];
    Object.defineProperty(indexed, '0', { get() { reads += 1; throw new Error('index'); } });
    for (const input of [[row(), row()], [hostile], indexed, new Array(1), [new Date()], [{ ...row(), source: { kind: 'svg', markup: svg, url: '/icon' } }]]) {
      expect(admitMapImages(input).ok).to.equal(false);
    }
    expect(reads).to.equal(0);
  });

  it('bounds counts, dimensions, ratios, per-image and aggregate pixels and UTF-8 source bytes', () => {
    for (const input of [
      Array.from({ length: MAP_IMAGE_LIMITS.count + 1 }, (_, index) => row(String(index))),
      [{ ...row(), width: Infinity }], [{ ...row(), height: 0 }], [{ ...row(), pixelRatio: 5 }],
      Array.from({ length: 5 }, (_, index) => ({ ...row(String(index)), width: 2048, height: 2048 })),
      [{ ...row(), source: { kind: 'svg', markup: '€'.repeat(Math.floor(MAP_IMAGE_LIMITS.svgBytes / 3) + 1) } }],
    ]) expect(admitMapImages(input).ok).to.equal(false);
  });
});

describe('map image catalogs and signed distance fields', () => {
  it('admits a sprite catalog beyond 64 images within the shared budget', () => {
    const catalog = Array.from({ length: 300 }, (_, index) => row(`poi-${index}`));
    const result = admitMapImages(catalog);
    expect(result.ok).to.equal(true);
    if (result.ok) expect(result.images.length).to.equal(300);
    expect(MAP_IMAGE_LIMITS.count).to.equal(1024);
    // The aggregate pixel budget still binds well before the count does.
    expect(admitMapImages(Array.from({ length: 300 }, (_, index) => ({ ...row(`big-${index}`), width: 256, height: 256 }))).ok).to.equal(false);
  });

  it('admits an optional boolean sdf flag and carries it to the prepared image', async () => {
    const admitted = admitMapImages([{ ...row('body'), sdf: true }, { ...row('plain'), sdf: false }, row('unset')]);
    expect(admitted.ok).to.equal(true);
    if (!admitted.ok) return;
    expect(admitted.images.map(image => image.sdf)).to.deep.equal([true, undefined, undefined]);
    for (const sdf of ['true', 1, null]) expect(admitMapImages([{ ...row(), sdf }]).ok, String(sdf)).to.equal(false);
    const prepared = await prepareMapImages([{ ...row('body'), sdf: true }, row('plain')], await context(), fakeServices());
    expect(prepared.ok).to.equal(true);
    if (prepared.ok) { expect(prepared.images.map(image => image.sdf)).to.deep.equal([true, undefined]); prepared.dispose(); }
  });
});

describe('map image preparation ownership', () => {
  it('always sanitizes SVG, removes secondary resources, and owns idempotent disposal', async () => {
    const ctx = await context();
    let sanitized = 0;
    let disposed = 0;
    let serialized = '';
    const services = fakeServices(() => { disposed += 1; });
    const result = await prepareMapImages([{ ...row(), source: { kind: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script><image href="data:image/png;base64,AAAA"/><foreignObject/><filter id="f"/><use href="#x"/><rect onload="bad()" style="fill:red" fill="url(https://example.invalid/x)" width="8" height="8"/></svg>' } }], ctx, {
      ...services,
      loadSanitizer: () => Promise.resolve({ sanitize: (value: string) => { sanitized += 1; return value; } }),
      rasterize: async (input) => { serialized = input.svg ?? ''; return services.rasterize!(input, ctx); },
    });
    expect(result.ok).to.equal(true);
    expect(sanitized).to.equal(1);
    expect(/script|<image|foreignObject|<filter|<use|onload|style=|https:/iu.test(serialized)).to.equal(false);
    if (!result.ok) return;
    expect(result.images[0]!.image?.data.length).to.equal(8 * 8 * 4);
    result.dispose(); result.dispose(); result.images[0]!.dispose();
    expect(disposed).to.equal(1);
    expect(result.images[0]!.image).to.equal(null);
  });

  it('fails closed without a sanitizer and never decodes on unsafe URL schemes', async () => {
    const ctx = await context();
    let decoded = 0;
    const services = { ...fakeServices(), rasterize: async () => { decoded += 1; return { image: new ImageData(8, 8), dispose() {} }; } };
    const missing = await prepareMapImages([row()], ctx, { ...services, loadSanitizer: () => Promise.resolve(null) });
    expect(missing.ok).to.equal(false);
    for (const url of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'blob:https://example.invalid/x', 'https://user:password@example.invalid/icon']) {
      const result = await prepareMapImages([{ ...row(), source: { kind: 'url', url } }], ctx, services);
      expect(result.ok).to.equal(false);
    }
    expect(decoded).to.equal(0);
  });

  it('disposes late raster results after supersession and rolls back earlier batch results', async () => {
    const ctx = await context();
    let current = true;
    let disposed = 0;
    let calls = 0;
    const result = await prepareMapImages([row('a'), row('b')], { ...ctx, isCurrent: () => current }, {
      ...fakeServices(),
      rasterize: async (input) => {
        calls += 1;
        if (calls === 2) current = false;
        return { image: new ImageData(input.width, input.height), dispose() { disposed += 1; } };
      },
    });
    expect(result.ok).to.equal(false);
    if (result.ok) return;
    expect(result.issue.code).to.equal('aborted');
    expect(disposed).to.equal(2);
  });

  it('guards sanitizer awaits and pre-aborted assignments before decoding', async () => {
    const ctx = await context();
    let decoded = 0;
    const result = await prepareMapImages([row()], ctx, {
      ...fakeServices(), loadSanitizer: async () => { ctx.abort.abort(); return { sanitize: (value: string) => value }; },
      rasterize: async () => { decoded += 1; return { image: new ImageData(8, 8), dispose() {} }; },
    });
    expect(result.ok).to.equal(false);
    if (!result.ok) expect(result.issue.code).to.equal('aborted');
    expect(decoded).to.equal(0);
  });
});

describe('map image CORS fetch and failure boundaries', () => {
  it('uses owner-realm CORS fetch without credentials or redirects and sanitizes fetched SVG', async () => {
    const ctx = await context();
    const nativeFetch = window.fetch;
    let options: RequestInit | undefined;
    let sanitized = 0;
    window.fetch = async (_url, init) => {
      options = init;
      const response = new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } });
      Object.defineProperty(response, 'type', { value: 'cors' });
      return response;
    };
    try {
      const result = await prepareMapImages([{ ...row(), source: { kind: 'url', url: '/map-icon.svg' } }], ctx, {
        ...fakeServices(), loadSanitizer: () => Promise.resolve({ sanitize: (value: string) => { sanitized += 1; return value; } }),
      });
      expect(result.ok).to.equal(true);
      expect(options?.mode).to.equal('cors'); expect(options?.credentials).to.equal('omit'); expect(options?.redirect).to.equal('error');
      expect(options?.signal === ctx.signal).to.equal(true); expect(sanitized).to.equal(1);
      if (result.ok) result.dispose();
    } finally { window.fetch = nativeFetch; }
  });

  it('rejects opaque responses, oversize streams and unsupported MIME before decoding', async () => {
    const ctx = await context();
    const nativeFetch = window.fetch;
    let decoded = 0;
    const services: MapImagePreparationServices = { ...fakeServices(), rasterize: async () => { decoded += 1; return { image: new ImageData(8, 8), dispose() {} }; } };
    try {
      for (const variant of ['opaque', 'limit', 'mime']) {
        window.fetch = async () => {
          const response = new Response(svg, { headers: { 'content-type': variant === 'mime' ? 'text/html' : 'image/svg+xml',
            ...(variant === 'limit' ? { 'content-length': String(MAP_IMAGE_LIMITS.encodedBytes + 1) } : {}) } });
          Object.defineProperty(response, 'type', { value: variant === 'opaque' ? 'opaque' : 'basic' });
          return response;
        };
        const result = await prepareMapImages([{ ...row(), source: { kind: 'url', url: 'https://example.invalid/icon' } }], ctx, services);
        expect(result.ok).to.equal(false);
      }
      expect(decoded).to.equal(0);
    } finally { window.fetch = nativeFetch; }
  });
});

describe('map image default decoder cancellation', () => {
  it('clears a pending image source and its handlers when the owning signal aborts', async () => {
    const ctx = await context();
    const descriptor = Object.getOwnPropertyDescriptor(window, 'Image');
    let pending: PendingImage | undefined;
    let removed = 0;
    class PendingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { pending = this; }
      set src(_value: string) { queueMicrotask(() => ctx.abort.abort()); }
      removeAttribute(name: string) { if (name === 'src') removed += 1; }
    }
    Object.defineProperty(window, 'Image', { configurable: true, value: PendingImage });
    try {
      const result = await prepareMapImages([row()], ctx, { loadSanitizer: fakeServices().loadSanitizer });
      expect(result.ok).to.equal(false);
      if (!result.ok) expect(result.issue.code).to.equal('aborted');
      expect(removed > 0).to.equal(true);
      expect(pending?.onload).to.equal(null); expect(pending?.onerror).to.equal(null);
    } finally {
      if (descriptor) Object.defineProperty(window, 'Image', descriptor);
      else Reflect.deleteProperty(window, 'Image');
    }
  });

  it('rejects malformed SVG geometry before calling a rasterizer', async () => {
    const ctx = await context();
    let decodes = 0;
    for (const geometry of ['width="999999"', 'viewBox="0 0 0x10 8"', 'viewBox="0 0 1e309 8"']) {
      const result = await prepareMapImages([{ ...row(), source: { kind: 'svg', markup: `<svg xmlns="http://www.w3.org/2000/svg" ${geometry}><rect width="8" height="8"/></svg>` } }], ctx, {
        ...fakeServices(), rasterize: async () => { decodes += 1; return { image: new ImageData(8, 8), dispose() {} }; },
      });
      expect(result.ok).to.equal(false);
    }
    expect(decodes).to.equal(0);
  });
});

describe('map image cumulative streaming limits', () => {
  for (const advertisedLength of [undefined, '12']) {
    it(`cancels cumulative overflow with ${advertisedLength === undefined ? 'absent' : 'lying'} Content-Length and rolls back earlier resources`, async () => {
      const ctx = await context();
      const nativeFetch = window.fetch;
      let cancelled = 0;
      let chunks = 0;
      let decodes = 0;
      let disposed = 0;
      window.fetch = async () => {
        const body = new ReadableStream<Uint8Array>({
          pull(controller) {
            chunks += 1;
            // Neither individual chunk exceeds the per-image cap; their sum does.
            controller.enqueue(new Uint8Array(Math.floor(MAP_IMAGE_LIMITS.encodedBytes / 2) + 100));
          },
          cancel() { cancelled += 1; },
        });
        const response = new Response(body, { headers: { 'content-type': 'image/png',
          ...(advertisedLength === undefined ? {} : { 'content-length': advertisedLength }) } });
        Object.defineProperty(response, 'type', { value: 'cors' });
        return response;
      };
      try {
        const result = await prepareMapImages([row('earlier'), { ...row('overflow'), source: { kind: 'url', url: 'https://example.invalid/overflow.png' } }], ctx, {
          ...fakeServices(), rasterize: async (input) => {
            decodes += 1;
            return { image: new ImageData(input.width, input.height), dispose() { disposed += 1; } };
          },
        });
        expect(result.ok).to.equal(false);
        if (!result.ok) expect(result.issue.code).to.equal('limit');
        expect(chunks >= 2).to.equal(true);
        expect(cancelled).to.equal(1);
        expect(decodes).to.equal(1, 'overflowing raster never reaches the decoder');
        expect(disposed).to.equal(1, 'earlier prepared image is released on batch failure');
      } finally { window.fetch = nativeFetch; }
    });
  }
});

// Valid chunk CRCs ensure the pipeline rejects auxiliary payload policy, not corrupt headers.
const auxiliaryPngFixtures = [
  { name: 'iCCP', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAFGlDQ1BwAAB4nKuoGAWjYBSMVAAALE/gEB2P8GAAAAANSURBVHicY2D4z/AfAAQBAf9x60flAAAAAElFTkSuQmCC' },
  { name: 'zTXt', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAFHpUWHRrAAB4nKuoGAWjYBSMVAAALE/gEDN46KgAAAANSURBVHicY2D4z/AfAAQBAf9x60flAAAAAElFTkSuQmCC' },
  { name: 'iTXt-compressed', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAF2lUWHRrAAEAAAB4nKuoGAWjYBSMVAAALE/gEMZvI1sAAAANSURBVHicY2D4z/AfAAQBAf9x60flAAAAAElFTkSuQmCC' },
  { name: 'iTXt-uncompressed', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAB2lUWHRrAAAAAAB4xh6idgAAAA1JREFUeJxjYPjP8B8ABAEB/3HrR+UAAAAASUVORK5CYII=' },
] as const;

describe('map image PNG metadata admission before native decode', () => {
  for (const fixture of auxiliaryPngFixtures) {
    it(`does not decode a PNG containing ${fixture.name}`, async () => {
      const ctx = await context();
      const nativeFetch = window.fetch;
      let decoded = 0;
      const bytes = Uint8Array.from(atob(fixture.base64), (character) => character.charCodeAt(0));
      window.fetch = async () => {
        const response = new Response(bytes, { headers: { 'content-type': 'image/png' } });
        Object.defineProperty(response, 'type', { value: 'basic' });
        return response;
      };
      try {
        const result = await prepareMapImages([{ ...row(), source: { kind: 'url', url: 'https://example.invalid/metadata.png' } }], ctx, {
          ...fakeServices(), rasterize: async () => { decoded += 1; return { image: new ImageData(8, 8), dispose() {} }; },
        });
        expect(result.ok).to.equal(false);
        if (!result.ok) expect(result.issue.code).to.equal('unsupported-format');
        expect(decoded).to.equal(0);
      } finally { window.fetch = nativeFetch; }
    });
  }
});
