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
});
