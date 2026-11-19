import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LitElement } from 'lit';
import {
  ViewerSourceController,
  ViewerSourceHttpError,
  ViewerSourceUrlNotAllowedError,
  type ViewerSourceToken,
} from './viewer-source-controller.js';
import { LyraResourceLimitError } from './resource-loader.js';

interface Harness {
  loads: string[];
  errors: unknown[];
  stale: boolean[];
  controller: ViewerSourceController;
}

class SourceHost extends LitElement {
  harness!: Harness;
  retain = false;
  override connectedCallback(): void {
    super.connectedCallback();
    this.harness ??= this.createHarness();
  }
  createHarness(): Harness {
    const harness: Harness = { loads: [], errors: [], stale: [], controller: undefined as never };
    harness.controller = new ViewerSourceController(this, {
      maxBytes: 8,
      load: async (response: Response, token: ViewerSourceToken) => {
        const text = await harness.controller.readText(response);
        harness.stale.push(harness.controller.isStale(token));
        if (!harness.controller.isStale(token)) harness.loads.push(text);
      },
      onError: (error: unknown) => harness.errors.push(error),
      retainAcrossMove: () => this.retain,
    });
    return harness;
  }
}
customElements.define('lr-test-viewer-source-host', SourceHost);

function trackedResponse(text: string, init: ResponseInit = {}, keepOpen = false) {
  const state = { cancelled: false };
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(bytes);
      if (!keepOpen) controller.close();
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { state, response: new Response(body, init) };
}

describe('ViewerSourceController', () => {
  const realFetch = window.fetch;
  afterEach(() => {
    window.fetch = realFetch;
  });

  async function host() {
    const el = await fixture<SourceHost>(html`<lr-test-viewer-source-host></lr-test-viewer-source-host>`);
    return el;
  }

  it('loads an ok response and drops a stale generation', async () => {
    const el = await host();
    const gates: Array<() => void> = [];
    window.fetch = ((url: string) =>
      new Promise<Response>((resolve) => {
        gates.push(() => resolve(new Response(url.endsWith('/a') ? 'AAA' : 'BBB')));
      })) as typeof fetch;
    const first = el.harness.controller.begin('/a');
    const second = el.harness.controller.begin('/b');
    gates[1]!();
    gates[0]!();
    await Promise.all([first, second]);
    expect(el.harness.loads).to.deep.equal(['BBB']);
    expect(el.harness.errors.length).to.equal(0);
  });

  it('cancels the body of a non-ok response and reports the status', async () => {
    const el = await host();
    const { state, response } = trackedResponse('nope', { status: 404, statusText: 'Not Found' });
    window.fetch = (() => Promise.resolve(response)) as typeof fetch;
    await el.harness.controller.begin('/missing');
    expect(state.cancelled).to.equal(true);
    expect(el.harness.errors[0] instanceof ViewerSourceHttpError).to.equal(true);
    expect(el.harness.loads.length).to.equal(0);
  });

  it('cancels the body of a response that went stale before it arrived', async () => {
    const el = await host();
    const { state, response } = trackedResponse('late');
    let release!: () => void;
    window.fetch = (() => new Promise<Response>((resolve) => (release = () => resolve(response)))) as typeof fetch;
    const pending = el.harness.controller.begin('/late');
    el.harness.controller.cancel();
    release();
    await pending;
    expect(state.cancelled).to.equal(true);
    expect(el.harness.loads.length + el.harness.errors.length).to.equal(0);
  });

  it('aborts the in-flight request when the host disconnects', async () => {
    const el = await host();
    let signal: AbortSignal | undefined;
    window.fetch = ((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }) as typeof fetch;
    const pending = el.harness.controller.begin('/slow');
    await waitUntil(() => signal !== undefined);
    el.remove();
    await pending;
    expect(signal?.aborted).to.equal(true);
    expect(el.harness.errors.length).to.equal(0);
  });

  it('enforces the byte ceiling and cancels the stream', async () => {
    const el = await host();
    const { state, response } = trackedResponse('this body is far too long', {}, true);
    window.fetch = (() => Promise.resolve(response)) as typeof fetch;
    await el.harness.controller.begin('/big');
    expect(el.harness.errors[0] instanceof LyraResourceLimitError).to.equal(true);
    expect(state.cancelled).to.equal(true);
  });

  it('rejects a disallowed scheme without fetching', async () => {
    const el = await host();
    let fetched = 0;
    window.fetch = (() => {
      fetched += 1;
      return Promise.resolve(new Response(''));
    }) as typeof fetch;
    await el.harness.controller.begin('javascript:alert(1)');
    expect(fetched).to.equal(0);
    expect(el.harness.errors[0] instanceof ViewerSourceUrlNotAllowedError).to.equal(true);
  });

  it('treats an empty source as a cancel only', async () => {
    const el = await host();
    const before = el.harness.controller.generation;
    await el.harness.controller.begin('');
    expect(el.harness.controller.generation).to.be.greaterThan(before);
    expect(el.harness.errors.length).to.equal(0);
  });
  it('reports an AbortError raised while its own signal is still live', async () => {
    const el = await host();
    window.fetch = (() => Promise.reject(new DOMException('body aborted', 'AbortError'))) as typeof fetch;
    await el.harness.controller.begin('/abort');
    expect(el.harness.errors.length).to.equal(1);
    expect((el.harness.errors[0] as DOMException).name).to.equal('AbortError');
  });

  it('loads without a signal when the owner window has no AbortController', async () => {
    const el = await host();
    const target = window as unknown as Record<string, unknown>;
    const original = target['AbortController'];
    let init: RequestInit | undefined = {};
    window.fetch = ((_url: string, next?: RequestInit) => {
      init = next;
      return Promise.resolve(new Response('ok'));
    }) as typeof fetch;
    target['AbortController'] = undefined;
    try {
      await el.harness.controller.begin('/plain');
    } finally {
      target['AbortController'] = original;
    }
    expect(init === undefined).to.equal(true);
    expect(el.harness.loads).to.deep.equal(['ok']);
  });

  function gatedFetch() {
    const state: { signal?: AbortSignal; release?: () => void } = {};
    window.fetch = ((_url: string, init?: RequestInit) => {
      state.signal = init?.signal ?? undefined;
      return new Promise<Response>((resolve, reject) => {
        state.release = () => resolve(new Response('moved'));
        state.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }) as typeof fetch;
    return state;
  }

  it('keeps a retained load across a same-task move and completes it', async () => {
    const el = await host();
    el.retain = true;
    const state = gatedFetch();
    const pending = el.harness.controller.begin('/keep');
    await waitUntil(() => state.signal !== undefined);
    const parent = el.parentNode!;
    el.remove();
    parent.append(el);
    await Promise.resolve();
    expect(state.signal?.aborted).to.equal(false);
    state.release!();
    await pending;
    expect(el.harness.loads).to.deep.equal(['moved']);
  });

  it('cancels a retained load once the host stays detached', async () => {
    const el = await host();
    el.retain = true;
    const state = gatedFetch();
    const pending = el.harness.controller.begin('/drop');
    await waitUntil(() => state.signal !== undefined);
    el.remove();
    await pending;
    expect(state.signal?.aborted).to.equal(true);
    expect(el.harness.loads.length + el.harness.errors.length).to.equal(0);
  });

  it('cancels a retained load when a repeated disconnect is still pending', async () => {
    const el = await host();
    el.retain = true;
    const state = gatedFetch();
    const pending = el.harness.controller.begin('/twice');
    await waitUntil(() => state.signal !== undefined);
    const parent = el.parentNode!;
    el.remove();
    parent.append(el);
    el.remove();
    await pending;
    expect(state.signal?.aborted).to.equal(true);
  });

  it('cancels a retained load when the host moves into another document', async () => {
    const el = await host();
    el.retain = true;
    const frame = document.createElement('iframe');
    document.body.append(frame);
    await waitUntil(() => frame.contentDocument?.readyState === 'complete');
    try {
      const state = gatedFetch();
      const pending = el.harness.controller.begin('/away');
      await waitUntil(() => state.signal !== undefined);
      frame.contentDocument!.body.append(el);
      await pending;
      expect(state.signal?.aborted).to.equal(true);
      expect(el.harness.loads.length + el.harness.errors.length).to.equal(0);
    } finally {
      frame.remove();
    }
  });
});
