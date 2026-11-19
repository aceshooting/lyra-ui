import { expect, fixture, fixtureCleanup, html, oneEvent, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import type { LyraPptxViewer } from './pptx-viewer.js';
import './pptx-viewer.js';
import type JSZipType from 'jszip';
import type { PptxRendererModule, PptxViewerApi } from './pptx-loader.js';

const fixtureFetch = window.fetch;
let fixtureBytes: Promise<ArrayBuffer> | undefined;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function bytes(fresh: boolean): Promise<ArrayBuffer> {
  const module = await import('jszip') as unknown as { default: typeof JSZipType };
  fixtureBytes ??= fixtureFetch(new URL('./fixtures/table-stale-frame.pptx', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('Presentation fixture could not be read');
    return response.arrayBuffer();
  });
  const zip = await module.default.loadAsync(await fixtureBytes);
  // A stored package metadata part distinguishes old and current bytes without corrupting the ZIP.
  zip.file('docProps/transport.txt', fresh ? 'CURRENT_TRANSPORT' : 'RETIRED_TRANSPORT');
  return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' });
}
function currentBytes(buffer: ArrayBuffer): boolean {
  return new TextDecoder().decode(buffer).includes('CURRENT_TRANSPORT');
}
function fakeViewer(slideCount: number, destroyed: () => void = () => undefined): PptxViewerApi {
  return Object.assign(new EventTarget(), {
    slideCount, currentSlideIndex: 0,
    async goToSlide(index: number) { this.currentSlideIndex = index; },
    searchText: () => [], highlightSearchResult: async () => null,
    renderThumbnailToContainer: () => null, clearSearchHighlights() {}, destroy: destroyed,
  });
}
function installRenderer(element: LyraPptxViewer, open: PptxRendererModule['PptxViewer']['open'] = async buffer => fakeViewer(currentBytes(buffer) ? 2 : 1)): void {
  element.loadRenderer = async () => ({ PptxViewer: { open }, RECOMMENDED_ZIP_LIMITS: {
    maxEntries: 4000, maxEntryUncompressedBytes: 32 * 1024 * 1024,
    maxTotalUncompressedBytes: 256 * 1024 * 1024, maxMediaBytes: 192 * 1024 * 1024, maxConcurrency: 1,
  } });
}
async function loaded(element: LyraPptxViewer): Promise<void> {
  await waitUntil(() => element.pageViewerSnapshot.status === 'ready' && element.pageViewerSnapshot.pageCount === 2,
    'the current presentation reaches readiness');
}
function assertCurrent(element: LyraPptxViewer): void {
  expect(element.pageViewerSnapshot.status).to.equal('ready');
  expect(element.pageViewerSnapshot.pageCount).to.equal(2);
}

describe('lr-pptx-viewer transport ownership', () => {
  it('releases the unread response when the renderer fails to load', async () => {
    const originalFetch = window.fetch;
    let cancelled = false;
    window.fetch = async () => new Response(new ReadableStream<Uint8Array>({
      cancel() { cancelled = true; },
    }));
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      const failure = new Error('Could not load the renderer');
      el.loadRenderer = () => Promise.reject(failure);
      const reported = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/deck.pptx';
      expect((await reported).detail.error === failure).to.equal(true);
      await waitUntil(() => cancelled, 'the renderer failure left a response stream open');
    } finally {
      window.fetch = originalFetch;
    }
  });
  const originalFetch = window.fetch;
  afterEach(() => { fixtureCleanup(); window.fetch = originalFetch; });
  async function mount() {
    const element = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer
      .strings=${{ documentPreviewFailedToLoad: 'Document transport unavailable' }}></lr-pptx-viewer>`);
    installRenderer(element);
    const errors: unknown[] = [];
    element.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
    return { element, errors };
  }

  it('reports an active AbortError with a live signal and recovers on a new source', async () => {
    const pending = deferred<Response>();
    let signal: AbortSignal | null | undefined;
    window.fetch = (_input, init) => { signal = init?.signal; return pending.promise; };
    const { element, errors } = await mount();
    element.src = 'https://example.test/active';
    await waitUntil(() => signal !== undefined);
    expect(signal?.aborted).to.equal(false);
    const failure = new DOMException('Transport unexpectedly stopped', 'AbortError');
    pending.reject(failure);
    await waitUntil(() => element.shadowRoot!.querySelector('[part~="error"]') !== null,
      'a live request failure produces localized feedback');
    expect(signal?.aborted).to.equal(false);
    expect(errors.length).to.equal(1);
    expect(errors[0] === failure).to.equal(true);
    expect(element.shadowRoot!.querySelector('[part~="error"]')!.textContent).to.equal('Document transport unavailable');
    expect(element.shadowRoot!.textContent).not.to.include(failure.message);
    expect(element.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
    expect(element.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('false');
    const fresh = await bytes(true);
    window.fetch = async () => new Response(fresh.slice(0));
    element.src = 'https://example.test/recovered';
    await loaded(element);
    expect(element.shadowRoot!.querySelector('[part~="error"]') === null).to.equal(true);
    expect(errors.length).to.equal(1);
  });

  for (const outcome of ['response', 'failure'] as const) {
    it(`ignores a fetch ${outcome} queued just before src is replaced`, async () => {
      const pending = deferred<Response>();
      const fresh = await bytes(true);
      let calls = 0;
      window.fetch = () => ++calls === 1
        ? pending.promise
        : Promise.resolve(new Response(fresh.slice(0)));
      const { element, errors } = await mount();
      element.src = 'https://example.test/retired';
      await waitUntil(() => calls === 1);
      let cancelled = false;
      if (outcome === 'response') {
        pending.resolve(new Response(new ReadableStream<Uint8Array>({
          cancel() { cancelled = true; },
        })));
      } else {
        pending.reject(new Error('Retired fetch failed'));
      }
      element.src = 'https://example.test/current';
      await loaded(element);
      expect(errors).to.deep.equal([]);
      if (outcome === 'response') expect(cancelled).to.be.true;
    });
  }

  for (const action of ['replace', 'disconnect'] as const) {
    it(`silences an owner-aborted fetch on ${action} while allowing the next load`, async () => {
      const pending = deferred<Response>();
      const fresh = await bytes(true);
      let signal: AbortSignal | null | undefined;
      let calls = 0;
      window.fetch = (_input, init) => {
        if (++calls > 1) return Promise.resolve(new Response(fresh.slice(0)));
        signal = init?.signal;
        signal?.addEventListener('abort', () => pending.reject(new DOMException('Canceled by owner', 'AbortError')), { once: true });
        return pending.promise;
      };
      const { element, errors } = await mount();
      element.src = 'https://example.test/retired';
      await waitUntil(() => calls === 1);
      const parent = element.parentNode!;
      if (action === 'replace') element.src = 'https://example.test/replacement';
      else { element.remove(); await twoFrames(); }
      await waitUntil(() => signal?.aborted === true, 'the owning viewer aborts its request');
      if (action === 'disconnect') parent.appendChild(element);
      await loaded(element);
      expect(calls).to.equal(2);
      expect(errors).to.deep.equal([]);
      assertCurrent(element);
    });
  }

  for (const stage of ['fetch', 'body'] as const) {
    it(`resumes a pending ${stage} after a same-task move and rejects its late retired bytes`, async () => {
      const pendingFetch = deferred<Response>();
      const fresh = await bytes(true), stale = await bytes(false);
      let signal: AbortSignal | null | undefined;
      let calls = 0, readingBody = false;
      let bodyController!: ReadableStreamDefaultController<Uint8Array>;
      let bodySettled = false;
      const pendingBody = new ReadableStream<Uint8Array>({
        start(controller) { bodyController = controller; },
        pull() { readingBody = true; },
        cancel() { bodySettled = true; },
      }, { highWaterMark: 0 });
      window.fetch = (_input, init) => {
        if (++calls > 1) return Promise.resolve(new Response(fresh.slice(0)));
        signal = init?.signal;
        if (stage === 'fetch') return pendingFetch.promise;
        // The stream ignores transport cancellation so late bytes test request ownership.
        return Promise.resolve(new Response(pendingBody));
      };
      const { element, errors } = await mount();
      try {
        element.src = 'https://example.test/moved';
        await waitUntil(() => calls === 1 && (stage === 'fetch' || readingBody),
          'the pending fetch starts or the response stream receives reader demand');
        const parent = element.parentNode!;
        element.remove(); parent.appendChild(element);
        expect(signal?.aborted).to.equal(true);
        await loaded(element);
        expect(calls).to.equal(2);
        if (stage === 'fetch') pendingFetch.resolve(new Response(stale.slice(0)));
        else {
          bodyController.enqueue(new Uint8Array(stale));
          bodyController.close();
          bodySettled = true;
        }
        await twoFrames();
        assertCurrent(element);
        expect(errors).to.deep.equal([]);
      } finally {
        // Settle cancellation-insensitive fixtures even if the liveness assertion fails.
        element.remove();
        pendingFetch.resolve(new Response(stale.slice(0)));
        if (!bodySettled) {
          bodyController.error(new DOMException('Fixture cleanup', 'AbortError'));
          bodySettled = true;
        }
        await twoFrames();
      }
    });
  }

  it('preserves a pending renderer open across a same-task move and destroys the acquired viewer once on real retirement', async () => {
    const pending = deferred<PptxViewerApi>();
    const fresh = await bytes(true);
    let fetches = 0, opens = 0, destroys = 0;
    const viewer = fakeViewer(2, () => { destroys++; });
    window.fetch = async () => { fetches++; return new Response(fresh.slice(0)); };
    const { element, errors } = await mount();
    const loads: number[] = [];
    element.addEventListener('lr-load', event => { loads.push(event.detail.slideCount); });
    installRenderer(element, () => { opens++; return pending.promise; });
    try {
      element.src = 'https://example.test/opening.pptx';
      await waitUntil(() => opens === 1, 'the renderer owns the pending open operation');
      const parent = element.parentNode!;
      element.remove(); parent.appendChild(element);
      await twoFrames();
      expect(fetches).to.equal(1); expect(opens).to.equal(1); expect(destroys).to.equal(0);
      pending.resolve(viewer);
      await loaded(element);
      expect(fetches).to.equal(1); expect(opens).to.equal(1); expect(destroys).to.equal(0);
      expect(loads).to.deep.equal([2]); expect(errors).to.deep.equal([]);
      element.remove();
      await twoFrames();
      expect(destroys).to.equal(1);
      element.remove(); await twoFrames();
      expect(destroys).to.equal(1);
    } finally {
      element.remove(); pending.resolve(viewer); await twoFrames();
    }
  });
});
