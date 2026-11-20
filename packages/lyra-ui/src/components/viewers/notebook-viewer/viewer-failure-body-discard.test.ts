import { expect, fixture, waitUntil } from '@open-wc/testing';
import { html, type TemplateResult } from 'lit';
import '../../lr-email-viewer.js';
import '../../lr-geojson-viewer.js';
import '../../lr-include.js';
import '../../lr-notebook-viewer.js';

const cases: readonly [string, TemplateResult][] = [
  ['lr-email-viewer', html`<lr-email-viewer src="https://example.test/failed.eml"></lr-email-viewer>`],
  ['lr-geojson-viewer', html`<lr-geojson-viewer src="https://example.test/failed.geojson"></lr-geojson-viewer>`],
  ['lr-include', html`<lr-include src="https://example.test/failed.html"></lr-include>`],
  ['lr-notebook-viewer', html`<lr-notebook-viewer src="https://example.test/failed.ipynb"></lr-notebook-viewer>`],
];

describe('failed responses release their unread body', () => {
  for (const [tag, template] of cases) {
    it(`${tag} cancels the body of an HTTP failure without reading it`, async () => {
      const state = { pulls: 0, cancelled: false };
      const body = new ReadableStream<Uint8Array>({
        pull(controller) { state.pulls++; controller.enqueue(new TextEncoder().encode('upstream')); controller.close(); },
        cancel() { state.cancelled = true; },
      }, { highWaterMark: 0 });
      const original = window.fetch;
      window.fetch = (() => Promise.resolve(new Response(body, { status: 503 }))) as typeof window.fetch;
      let failures = 0;
      try {
        await fixture(html`<div @lr-render-error=${() => { failures++; }} @lr-include-error=${() => { failures++; }}>${template}</div>`);
        await waitUntil(() => failures > 0 && state.cancelled);
        expect(state.pulls).to.equal(0);
      } finally {
        window.fetch = original;
      }
    });
  }
});
