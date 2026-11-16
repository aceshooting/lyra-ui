import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import type { LyraArchiveViewer } from './archive-viewer.js';
import './archive-viewer.js';
import { assembleZip, zipEntry } from './fixtures/zip-builder.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function bytes(fresh: boolean): Promise<ArrayBuffer> {
  return assembleZip([await zipEntry(fresh ? 'current.txt' : 'retired.txt', 'Document contents')]);
}
function names(element: LyraArchiveViewer): string[] {
  const list = element.shadowRoot?.querySelector('lr-virtual-list') as (HTMLElement & { items: { name: string }[] }) | null;
  return list?.items?.map(entry => entry.name) ?? [];
}
async function loaded(element: LyraArchiveViewer): Promise<void> {
  await waitUntil(() => names(element).includes('current.txt'), 'the current archive listing is shown');
}
function assertCurrent(element: LyraArchiveViewer): void { expect(names(element)).to.deep.equal(['current.txt']); }

describe('lr-archive-viewer transport ownership', () => {
  const originalFetch = window.fetch;
  afterEach(() => { fixtureCleanup(); window.fetch = originalFetch; });
  async function mount() {
    const element = await fixture<LyraArchiveViewer>(html`<lr-archive-viewer
      .strings=${{ documentPreviewFailedToLoad: 'Document transport unavailable' }}></lr-archive-viewer>`);
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
});
