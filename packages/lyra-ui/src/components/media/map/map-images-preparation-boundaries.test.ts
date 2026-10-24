import { expect, fixture, html } from '@open-wc/testing';
import { MAP_IMAGE_LIMITS, prepareMapImages, type MapImagePreparationServices, type MapImagePreparationResult } from './map-images.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="8" height="8" fill="red"/></svg>';
const row = (id = 'icon') => ({ id, width: 8, height: 8, pixelRatio: 1, source: { kind: 'svg', markup: svg } });
const urlRow = { ...row(), source: { kind: 'url', url: '/map-preparation-icon' } };
const services = (): MapImagePreparationServices => ({
  loadSanitizer: async () => ({ sanitize: (value: string) => value }),
  rasterize: async input => ({ image: new ImageData(input.width, input.height), dispose() {} }),
});

async function context() {
  const owner = await fixture<HTMLElement>(html`<div></div>`);
  return { owner, signal: new AbortController().signal, isCurrent: () => true };
}

function failure(result: MapImagePreparationResult, code: string) {
  expect(result.ok).to.equal(false);
  if (result.ok) { result.dispose(); throw new Error('Expected image preparation failure'); }
  expect(result.issue.code).to.equal(code);
}

function response(body: BodyInit, contentType?: string) {
  const value = new Response(body, { headers: contentType ? { 'content-type': contentType } : {} });
  Object.defineProperty(value, 'type', { value: 'basic' });
  return value;
}

describe('map image preparation boundaries', () => {
  it('rejects invalid descriptor batches before requesting a sanitizer or rasterizer', async () => {
    let loads = 0, decodes = 0;
    const ctx = await context();
    failure(await prepareMapImages([{ ...row(), width: 0 }], ctx, {
      loadSanitizer: async () => { loads += 1; return null; },
      rasterize: async () => { decodes += 1; return { image: new ImageData(8, 8), dispose() {} }; },
    }), 'invalid-descriptor');
    expect(loads).to.equal(0); expect(decodes).to.equal(0);
  });

  it('rejects non-whitespace outside the SVG root and excessive element counts before rasterization', async () => {
    const ctx = await context(); let decodes = 0;
    for (const [markup, code] of [
      [`outside${svg}`, 'invalid-svg'],
      [`<svg xmlns="http://www.w3.org/2000/svg">${'<g/>'.repeat(MAP_IMAGE_LIMITS.elements)}</svg>`, 'limit'],
    ] as const) {
      failure(await prepareMapImages([{ ...row(), source: { kind: 'svg', markup } }], ctx, {
        ...services(), rasterize: async () => { decodes += 1; return { image: new ImageData(8, 8), dispose() {} }; },
      }), code);
    }
    expect(decodes).to.equal(0);
    const result = await prepareMapImages([{ ...row(), source: { kind: 'svg', markup: ` \n${svg}\n ` } }], ctx, services());
    expect(result.ok).to.equal(true);
    if (result.ok) result.dispose();
  });

  it('reports native fetch rejection and permits the next fetch to prepare an image', async () => {
    const ctx = await context(), nativeFetch = window.fetch;
    try {
      window.fetch = async () => { throw new TypeError('Network unavailable'); };
      failure(await prepareMapImages([urlRow], ctx, services()), 'fetch');
      window.fetch = async () => response(svg, 'image/svg+xml');
      const result = await prepareMapImages([urlRow], ctx, services());
      expect(result.ok).to.equal(true);
      if (result.ok) { expect(result.images[0]!.id).to.equal('icon'); result.dispose(); }
    } finally { window.fetch = nativeFetch; }
  });

  it('validates a response URL and preserves that failure when cancelling its unread body also fails', async () => {
    const ctx = await context(), nativeFetch = window.fetch;
    let cancelled = 0, decodes = 0;
    window.fetch = async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new TextEncoder().encode(svg)); },
        cancel() { cancelled += 1; throw new Error('Body cancellation failed'); },
      });
      const value = response(body, 'image/svg+xml');
      const redirectUrl = new URL('https://example.test/icon.svg');
      redirectUrl.username = 'fixture-user';
      Object.defineProperty(value, 'url', { value: redirectUrl.href });
      return value;
    };
    try {
      failure(await prepareMapImages([urlRow], ctx, { ...services(), rasterize: async () => {
        decodes += 1; return { image: new ImageData(8, 8), dispose() {} };
      } }), 'unsafe-url');
      expect(cancelled).to.equal(1); expect(decodes).to.equal(0);
    } finally { window.fetch = nativeFetch; }
  });

  it('rejects fetched SVG with invalid UTF-8 or an excessive encoded payload before rasterization', async () => {
    const ctx = await context(), nativeFetch = window.fetch;
    let decodes = 0;
    try {
      for (const [bytes, code] of [
        [new Uint8Array([0xc3, 0x28]), 'invalid-svg'],
        [new Uint8Array(MAP_IMAGE_LIMITS.svgBytes + 1).fill(32), 'limit'],
      ] as const) {
        window.fetch = async () => response(bytes, 'image/svg+xml');
        failure(await prepareMapImages([urlRow], ctx, { ...services(), rasterize: async () => {
          decodes += 1; return { image: new ImageData(8, 8), dispose() {} };
        } }), code);
      }
      expect(decodes).to.equal(0);
      window.fetch = async () => response(new Uint8Array([1, 2, 3]));
      failure(await prepareMapImages([urlRow], ctx, services()), 'unsupported-format');
    } finally { window.fetch = nativeFetch; }
  });

  it('releases every earlier image when the final raster has incorrect dimensions and disposal throws', async () => {
    const ctx = await context(); let calls = 0;
    const disposed: number[] = [];
    const result = await prepareMapImages([row('first'), row('second'), row('invalid')], ctx, {
      ...services(), rasterize: async () => {
        const index = calls++;
        return { image: new ImageData(index === 2 ? 7 : 8, 8), dispose() { disposed.push(index); throw new Error('Raster release failed'); } };
      },
    });
    failure(result, 'decode');
    expect(calls).to.equal(3); expect(disposed).to.deep.equal([2, 0, 1]);
  });

  it('makes successful batch disposal idempotent even if one underlying raster release throws', async () => {
    const ctx = await context(); let calls = 0;
    const disposed: number[] = [];
    const result = await prepareMapImages([row('first'), row('second')], ctx, {
      ...services(), rasterize: async () => {
        const index = calls++;
        return { image: new ImageData(8, 8), dispose() { disposed.push(index); if (index === 0) throw new Error('First raster release failed'); } };
      },
    });
    expect(result.ok).to.equal(true);
    if (!result.ok) throw new Error('Expected prepared images');
    result.dispose(); result.dispose();
    expect(disposed).to.deep.equal([0, 1]);
    expect(result.images.map(image => image.image === null)).to.deep.equal([true, true]);
  });

  it('declines native decoding without an owner browsing context and recovers after adoption', async () => {
    const doc = document.implementation.createHTMLDocument('Image preparation');
    const owner = doc.createElement('div'); doc.body.append(owner);
    const ctx = { owner, signal: new AbortController().signal, isCurrent: () => true };
    expect(owner.isConnected).to.equal(true); expect(owner.ownerDocument.defaultView).to.equal(null);
    failure(await prepareMapImages([row()], ctx, { loadSanitizer: services().loadSanitizer }), 'aborted');
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    wrapper.append(owner);
    const result = await prepareMapImages([row()], ctx, { loadSanitizer: services().loadSanitizer });
    expect(result.ok).to.equal(true);
    if (!result.ok) throw new Error('Expected native decoding after adoption');
    try {
      expect(result.images[0]!.image?.width).to.equal(8);
      expect([...result.images[0]!.image!.data.slice(0, 4)]).to.deep.equal([255, 0, 0, 255]);
    } finally { result.dispose(); }
  });
});
