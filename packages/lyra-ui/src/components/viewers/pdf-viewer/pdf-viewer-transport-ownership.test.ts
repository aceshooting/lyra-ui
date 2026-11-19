import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import type { LyraPdfViewer } from './pdf-viewer.js';
import './pdf-viewer.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function documentWithPages(numPages: number) {
  return { numPages, getPage: async (pageNumber: number) => ({
    pageNumber,
    getViewport: ({ scale = 1 }: { scale?: number } = {}) => ({ width: 200 * scale, height: 300 * scale, scale }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
    getTextContent: async () => ({ items: [] }),
    streamTextContent: () => new ReadableStream({ start(controller) { controller.close(); } }),
  }) };
}
class TextLayer {
  async render(): Promise<void> {}
  cancel(): void {}
}
type LoadingTask = { promise: Promise<ReturnType<typeof documentWithPages>>; destroy?: () => Promise<void> };
function installLoader(element: LyraPdfViewer, getDocument: (options: { data: ArrayBuffer }) => LoadingTask = ({ data }) => ({
  promise: Promise.resolve(documentWithPages(new Uint8Array(data)[0]!)),
})) {
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({
    getDocument, GlobalWorkerOptions: { workerSrc: '' }, TextLayer,
  });
}
async function bytes(fresh: boolean): Promise<ArrayBuffer> { return new Uint8Array([fresh ? 2 : 1]).buffer; }
async function loaded(element: LyraPdfViewer): Promise<void> {
  await waitUntil(() => element.pageViewerSnapshot.status === 'ready' && element.pageViewerSnapshot.pageCount === 2,
    'the current PDF finishes loading');
}
function assertCurrent(element: LyraPdfViewer): void {
  expect(element.pageViewerSnapshot.status).to.equal('ready');
  expect(element.pageViewerSnapshot.pageCount).to.equal(2);
}

describe('lr-pdf-viewer transport ownership', () => {
  const originalFetch = window.fetch;
  afterEach(() => { fixtureCleanup(); window.fetch = originalFetch; });
  async function mount() {
    const element = await fixture<LyraPdfViewer>(html`<lr-pdf-viewer
      .strings=${{ documentPreviewFailedToLoad: 'Document transport unavailable' }}></lr-pdf-viewer>`);
    installLoader(element);
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

  it('restarts library acquisition after a move without creating a parser from the retired library result', async () => {
    const oldLibrary = deferred<unknown>();
    const fresh = await bytes(true);
    let fetches = 0, libraries = 0, retiredParsers = 0, currentParsers = 0;
    window.fetch = async () => { fetches++; return new Response(fresh.slice(0)); };
    const { element, errors } = await mount();
    const loads: number[] = [];
    element.addEventListener('lr-load', event => { loads.push(event.detail.pageCount); });
    const retiredLibrary = { GlobalWorkerOptions: { workerSrc: '' }, TextLayer, getDocument: () => {
      retiredParsers++; return { promise: Promise.resolve(documentWithPages(1)) };
    } };
    (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => {
      if (++libraries === 1) return oldLibrary.promise;
      return { GlobalWorkerOptions: { workerSrc: '' }, TextLayer, getDocument: () => {
        currentParsers++; return { promise: Promise.resolve(documentWithPages(2)) };
      } };
    };
    try {
      element.src = 'https://example.test/pending-library';
      await waitUntil(() => libraries === 1, 'the first request is waiting for its PDF library');
      const parent = element.parentNode!;
      element.remove(); parent.appendChild(element);
      await loaded(element);
      expect(fetches).to.equal(2);
      // Each mounted text layer also acquires the library after the current document is ready.
      expect(libraries, 'the moved request reacquires the library').to.be.at.least(2);
      expect(currentParsers).to.equal(1);
      oldLibrary.resolve(retiredLibrary);
      await twoFrames();
      expect(retiredParsers, 'retired library acquisition never installs a parser').to.equal(0);
      expect(loads, 'only the current document publishes readiness').to.deep.equal([2]);
      expect(errors).to.deep.equal([]);
      assertCurrent(element);
    } finally {
      element.remove(); oldLibrary.resolve(retiredLibrary); await twoFrames();
    }
  });

  it('retires a parser returned by getDocument after a synchronous move and cleans it exactly once', async () => {
    const oldDocument = deferred<ReturnType<typeof documentWithPages>>();
    const fresh = await bytes(true);
    let fetches = 0, tasks = 0, taskDestroys = 0, documentDestroys = 0;
    window.fetch = async () => { fetches++; return new Response(fresh.slice(0)); };
    const { element, errors } = await mount();
    const loads: number[] = [];
    element.addEventListener('lr-load', event => { loads.push(event.detail.pageCount); });
    installLoader(element, () => {
      if (++tasks !== 1) return { promise: Promise.resolve(documentWithPages(2)) };
      const parent = element.parentNode!;
      element.remove(); parent.appendChild(element);
      return { promise: oldDocument.promise, destroy: async () => { taskDestroys++; } };
    });
    try {
      element.src = 'https://example.test/reentrant-parser';
      await waitUntil(() => tasks >= 1, 'getDocument synchronously moves its owning viewer');
      await loaded(element);
      expect(fetches).to.equal(2);
      expect(tasks).to.equal(2);
      expect(taskDestroys, 'the task returned after retirement is destroyed before it settles').to.equal(1);
      const lateDocument = { ...documentWithPages(1), destroy: async () => { documentDestroys++; } };
      oldDocument.resolve(lateDocument);
      await twoFrames();
      expect(taskDestroys).to.equal(1);
      expect(documentDestroys, 'the retired loading task already owns document cleanup').to.equal(0);
      expect(loads).to.deep.equal([2]);
      expect(errors).to.deep.equal([]);
      assertCurrent(element);
    } finally {
      element.remove(); oldDocument.resolve(documentWithPages(1)); await twoFrames();
    }
  });

  for (const action of ['finish', 'replace', 'disconnect'] as const) {
    it(`preserves a pending PDF parsing task across a same-task move, then handles ${action} with one owner`, async () => {
      const pending = deferred<ReturnType<typeof documentWithPages>>();
      const fresh = await bytes(true);
      let fetches = 0, tasks = 0, taskDestroys = 0, lateDocumentDestroys = 0;
      window.fetch = async () => { fetches++; return new Response(fresh.slice(0)); };
      const { element, errors } = await mount();
      installLoader(element, () => {
        tasks++;
        return tasks === 1
          ? { promise: pending.promise, destroy: async () => { taskDestroys++; } }
          : { promise: Promise.resolve(documentWithPages(2)) };
      });
      element.src = 'https://example.test/parsing';
      await waitUntil(() => tasks === 1, 'transport completed and PDF parsing owns the pending document');
      const parent = element.parentNode!;
      element.remove(); parent.appendChild(element);
      try {
        await twoFrames();
        expect(fetches, 'completed transport is not restarted by a move').to.equal(1);
        expect(tasks, 'the pending parser retains ownership during a move').to.equal(1);
        expect(taskDestroys).to.equal(0);
        if (action === 'finish') {
          pending.resolve(documentWithPages(2));
          await loaded(element);
          expect(taskDestroys).to.equal(0);
        } else {
          if (action === 'replace') element.src = 'https://example.test/replacement';
          else element.remove();
          await waitUntil(() => taskDestroys === 1, 'real retirement destroys the pending task');
          if (action === 'disconnect') parent.appendChild(element);
          await loaded(element);
          const lateDocument = { ...documentWithPages(1), destroy: async () => { lateDocumentDestroys++; } };
          pending.resolve(lateDocument);
          await twoFrames();
          assertCurrent(element);
          expect(taskDestroys, 'late resolution never destroys an already retired task twice').to.equal(1);
          expect(lateDocumentDestroys, 'the destroyed loading task already owns document cleanup').to.equal(0);
          expect(fetches).to.equal(2);
          expect(tasks).to.equal(2);
        }
        expect(errors).to.deep.equal([]);
      } finally {
        element.remove();
        pending.resolve(documentWithPages(1));
        await twoFrames();
      }
    });
  }
});
