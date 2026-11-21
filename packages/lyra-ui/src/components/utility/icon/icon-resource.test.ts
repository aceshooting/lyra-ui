import { expect } from '@open-wc/testing';
import { __clearIconResourceCacheForTesting, acquireSanitizedIconResource, IconResourceError } from './icon-resource.js';

type Handler = (url: string, init?: RequestInit) => Promise<Response>;

function target(url: string, handler: Handler) {
  const view = { document, fetch: handler } as unknown as Window & typeof globalThis;
  return { url, view };
}

async function reasonOf(promise: Promise<unknown>): Promise<unknown> {
  try { await promise; } catch (error) { return error instanceof IconResourceError ? error.reason : error; }
  return 'resolved';
}

describe('icon resource loading', () => {
  beforeEach(() => __clearIconResourceCacheForTesting());
  after(() => __clearIconResourceCacheForTesting());

  it('fails as a load error when the request rejects', async () => {
    const lease = acquireSanitizedIconResource(target('/a.svg', () => Promise.reject(new TypeError('offline'))));
    expect(await reasonOf(lease.promise)).to.equal('load');
    lease.release();
  });

  it('keeps an abort distinct from a load error', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const lease = acquireSanitizedIconResource(target('/b.svg', () => Promise.reject(abort)));
    const error = await reasonOf(lease.promise);
    expect((error as Error).name).to.equal('AbortError');
    lease.release();
  });

  it('fails a non-ok response', async () => {
    const lease = acquireSanitizedIconResource(target('/c.svg', () => Promise.resolve(new Response('no', { status: 404, statusText: 'Not Found' }))));
    expect(await reasonOf(lease.promise)).to.equal('load');
    lease.release();
  });

  it('fails an oversized body as too-large', async () => {
    const big = 'x'.repeat(1024 * 1024 + 10);
    const lease = acquireSanitizedIconResource(target('/d.svg', () => Promise.resolve(new Response(big, { status: 200 }))));
    expect(await reasonOf(lease.promise)).to.equal('too-large');
    lease.release();
  });

  it('fails a body that errors mid-read, and an abort while reading', async () => {
    const broken = new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('reset')); } }));
    const lease = acquireSanitizedIconResource(target('/e.svg', () => Promise.resolve(broken)));
    expect(await reasonOf(lease.promise)).to.equal('load');
    lease.release();
    const aborted = new Response(new ReadableStream({ start(controller) { controller.error(Object.assign(new Error('x'), { name: 'AbortError' })); } }));
    const second = acquireSanitizedIconResource(target('/f.svg', () => Promise.resolve(aborted)));
    expect(((await reasonOf(second.promise)) as Error).name).to.equal('AbortError');
    second.release();
  });

  it('resolves null for a blank body and rejects a non-SVG document', async () => {
    const blank = acquireSanitizedIconResource(target('/g.svg', () => Promise.resolve(new Response('  \n'))));
    expect((await blank.promise) === null).to.equal(true);
    blank.release();
    const html = acquireSanitizedIconResource(target('/h.svg', () => Promise.resolve(new Response('<p>hi</p>'))));
    expect(await reasonOf(html.promise)).to.equal('load');
    html.release();
  });

  it('shares one load per owner and url and strips active content', async () => {
    let calls = 0;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" style="fill:red"><style>a{}</style><use href="https://x.test/a.svg#i" /><use href="#local" /><path d="M0 0" fill="url(https://x.test/a)"/></svg>';
    const t = target('/i.svg', () => { calls++; return Promise.resolve(new Response(svg)); });
    const first = acquireSanitizedIconResource(t);
    const second = acquireSanitizedIconResource(t);
    const node = (await first.promise)!;
    expect((await second.promise) === node).to.equal(true);
    expect(calls).to.equal(1);
    expect(node.querySelector('style') === null).to.equal(true);
    expect(node.hasAttribute('style')).to.equal(false);
    const uses = [...node.querySelectorAll('use')];
    expect(uses.map(use => use.getAttribute('href'))).to.deep.equal([null, '#local']);
    first.release();
    second.release();
  });
});
