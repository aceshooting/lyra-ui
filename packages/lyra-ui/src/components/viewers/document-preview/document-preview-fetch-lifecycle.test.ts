import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './document-preview.js';
import type { LyraDocumentPreview } from './document-preview.js';

const originalFetch = window.fetch;
afterEach(() => { window.fetch = originalFetch; });

for (const status of ['converting', 'error'] as const) {
  it(`aborts a pending text response body when entering ${status} and ignores its late completion after recovery`, async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    let signal: AbortSignal | null | undefined;
    let fetches = 0;
    window.fetch = async (_input, init) => {
      fetches++;
      if (fetches === 1) {
        signal = init?.signal;
        return new Response(body);
      }
      return new Response('Recovered content');
    };
    const element = await fixture<LyraDocumentPreview>(html`<lr-document-preview mime-type="text/plain" src="https://example.test/document.txt"></lr-document-preview>`);
    let errors = 0;
    element.addEventListener('lr-render-error', () => errors++);
    await waitUntil(() => body.locked);
    expect(signal?.aborted).to.equal(false);
    element.status = status;
    expect(await element.updateComplete).to.equal(true);
    expect(signal?.aborted).to.equal(true);
    expect(element.shadowRoot!.querySelector('pre') === null).to.equal(true);
    element.status = 'ready';
    await waitUntil(() => element.shadowRoot!.querySelector('pre')?.textContent === 'Recovered content');
    controller.enqueue(new TextEncoder().encode('Obsolete content'));
    controller.close();
    await waitUntil(() => !body.locked);
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('pre')?.textContent).to.equal('Recovered content');
    expect(fetches).to.equal(2);
    expect(errors).to.equal(0);
  });
}

it('contains a superseded response-body failure without replacing the newer text or emitting a render error', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  let signal: AbortSignal | null | undefined;
  window.fetch = async (input, init) => {
    if (String(input).endsWith('/old.txt')) {
      signal = init?.signal;
      return new Response(body);
    }
    return new Response('Current content');
  };
  const element = await fixture<LyraDocumentPreview>(html`<lr-document-preview mime-type="text/plain" src="https://example.test/old.txt"></lr-document-preview>`);
  let errors = 0;
  element.addEventListener('lr-render-error', () => errors++);
  await waitUntil(() => body.locked);
  element.src = 'https://example.test/current.txt';
  await waitUntil(() => element.shadowRoot!.querySelector('pre')?.textContent === 'Current content');
  expect(signal?.aborted).to.equal(true);
  controller.error(new Error('Obsolete response body failed'));
  await waitUntil(() => !body.locked);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('pre')?.textContent).to.equal('Current content');
  expect(element.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  expect(errors).to.equal(0);
});
