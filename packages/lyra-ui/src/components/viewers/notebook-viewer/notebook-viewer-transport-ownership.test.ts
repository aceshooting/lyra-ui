import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import type { LyraNotebookViewer } from './notebook-viewer.js';
import './notebook-viewer.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function pendingBody() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let demanded = false, settled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    pull() { demanded = true; },
    cancel() { settled = true; },
  }, { highWaterMark: 0 });
  return {
    stream,
    get demanded() { return demanded; },
    finish(text: string) {
      if (settled) return;
      settled = true;
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
    fail(error: unknown) {
      if (settled) return;
      settled = true;
      controller.error(error);
    },
  };
}

function documentText(fresh: boolean): string {
  return JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    cells: [{ cell_type: 'raw', id: fresh ? 'current' : 'retired', source: fresh ? 'Current document' : 'Retired document' }],
  });
}
function renderedText(element: LyraNotebookViewer): string { return element.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.textContent ?? ''; }
async function loaded(element: LyraNotebookViewer): Promise<void> {
  await waitUntil(() => renderedText(element).includes('Current document'),
    'the current document is rendered', { timeout: 5_000 });
  await element.updateComplete;
}
function assertCurrent(element: LyraNotebookViewer): void {
  expect(renderedText(element)).to.include('Current document');
  expect(renderedText(element)).not.to.include('Retired document');
  expect(element.shadowRoot!.querySelector('[part~="error"]') === null).to.equal(true);
  expect(element.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
  expect(element.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('false');
}

describe('lr-notebook-viewer transport ownership', () => {
  const originalFetch = window.fetch;
  afterEach(() => { fixtureCleanup(); window.fetch = originalFetch; });
  async function mount() {
    const element = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer style="block-size:300px"
      .strings=${{ documentPreviewFailedToLoad: 'Document transport unavailable' }}></lr-notebook-viewer>`);
    const errors: unknown[] = [];
    element.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
    return { element, errors };
  }

  for (const stage of ['fetch', 'body'] as const) {
    it(`reports an active ${stage} AbortError with a live signal and recovers on a new source`, async () => {
      const pending = deferred<Response>();
      const body = pendingBody();
      let signal: AbortSignal | null | undefined;
      window.fetch = (_input, init) => {
        signal = init?.signal;
        return stage === 'fetch' ? pending.promise : Promise.resolve(new Response(body.stream));
      };
      const { element, errors } = await mount();
      try {
        element.src = 'https://example.test/active';
        await waitUntil(() => signal !== undefined && (stage === 'fetch' || body.demanded),
          'the request starts and any response body receives reader demand');
        expect(signal?.aborted).to.equal(false);
        const failure = new DOMException('Transport unexpectedly stopped', 'AbortError');
        if (stage === 'fetch') pending.reject(failure);
        else body.fail(failure);
        await waitUntil(() => element.shadowRoot!.querySelector('[part~="error"]') !== null,
          'an active transport failure produces localized feedback');
        expect(signal?.aborted).to.equal(false);
        expect(errors.length).to.equal(1);
        expect(errors[0] === failure).to.equal(true);
        expect(element.shadowRoot!.querySelector('[part~="error"]')!.textContent).to.equal('Document transport unavailable');
        expect(element.shadowRoot!.textContent).not.to.include(failure.message);
        expect(element.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
        expect(element.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('false');
        window.fetch = async () => new Response(documentText(true));
        element.src = 'https://example.test/recovered';
        await loaded(element);
        assertCurrent(element);
        expect(errors.length).to.equal(1);
      } finally {
        element.remove();
        pending.resolve(new Response(documentText(false)));
        body.fail(new DOMException('Fixture cleanup', 'AbortError'));
        await twoFrames();
      }
    });
  }

  for (const stage of ['fetch', 'body'] as const) {
    it(`resumes a pending ${stage} after a same-task move and rejects late retired content`, async () => {
      const pending = deferred<Response>();
      const body = pendingBody();
      let signal: AbortSignal | null | undefined;
      let calls = 0;
      window.fetch = (_input, init) => {
        if (++calls > 1) return Promise.resolve(new Response(documentText(true)));
        signal = init?.signal;
        // Deliberately ignore transport cancellation to exercise late completion ownership.
        return stage === 'fetch' ? pending.promise : Promise.resolve(new Response(body.stream));
      };
      const { element, errors } = await mount();
      try {
        element.src = 'https://example.test/moved';
        await waitUntil(() => calls === 1 && (stage === 'fetch' || body.demanded),
          'the first request starts and any response body receives reader demand');
        const parent = element.parentNode!;
        element.remove(); parent.appendChild(element);
        expect(signal?.aborted).to.equal(true);
        await loaded(element);
        expect(calls).to.equal(2);
        if (stage === 'fetch') pending.resolve(new Response(documentText(false)));
        else body.finish(documentText(false));
        await twoFrames();
        assertCurrent(element);
        expect(errors).to.deep.equal([]);
      } finally {
        element.remove();
        pending.resolve(new Response(documentText(false)));
        body.fail(new DOMException('Fixture cleanup', 'AbortError'));
        await twoFrames();
      }
    });
  }

  it('keeps an owner-aborted response body silent on genuine disconnect and loads again on reconnect', async () => {
    const body = pendingBody();
    let signal: AbortSignal | null | undefined;
    let calls = 0;
    window.fetch = (_input, init) => {
      if (++calls > 1) return Promise.resolve(new Response(documentText(true)));
      signal = init?.signal;
      signal?.addEventListener('abort', () => body.fail(new DOMException('Canceled by owner', 'AbortError')), { once: true });
      return Promise.resolve(new Response(body.stream));
    };
    const { element, errors } = await mount();
    try {
      element.src = 'https://example.test/reconnected';
      await waitUntil(() => calls === 1 && body.demanded, 'the response body receives reader demand');
      expect(signal?.aborted).to.equal(false);
      const parent = element.parentNode!;
      element.remove();
      await twoFrames();
      expect(signal?.aborted).to.equal(true);
      expect(errors).to.deep.equal([]);
      expect(element.shadowRoot!.querySelector('[part~="error"]') === null).to.equal(true);
      parent.appendChild(element);
      await loaded(element);
      expect(calls).to.equal(2);
      assertCurrent(element);
      expect(errors).to.deep.equal([]);
    } finally {
      element.remove();
      body.fail(new DOMException('Fixture cleanup', 'AbortError'));
      await twoFrames();
    }
  });
});
