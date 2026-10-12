import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './email-viewer.js';
import type { LyraEmailViewer } from './email-viewer.js';
import { measureArrayProbeReads } from '../../../../test/array-probe-reads.js';

it('folds many expanded quotes with linear membership work and retains quote order and localized toggles', async () => {
  const body = Array.from({ length: 128 }, (_, index) => `<div class="gmail_quote"><p>Quoted ${index}</p></div>`).join('');
  const message = ['Subject: Quoted conversation', 'Content-Type: text/html; charset=utf-8', '', body].join('\r\n');
  const fetch = window.fetch;
  window.fetch = async (): Promise<Response> => new Response(message, { status: 200 });
  let viewer: LyraEmailViewer | undefined;
  try {
    viewer = await fixture<LyraEmailViewer>(html`<lr-email-viewer fold-quotes src="https://example.test/quote-cost.eml"></lr-email-viewer>`);
    const element = viewer;
    await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="quote-toggle"]').length === 128, 'Loaded quote toggles did not populate', { timeout: 10_000 });
    const expanded = Array.from({ length: 128 }, (_, index) => 127 - index);
    const seam = viewer as unknown as { expandedHtmlQuoteIndices: number[] };
    seam.expandedHtmlQuoteIndices = expanded;
    const measured = measureArrayProbeReads((array) => array === expanded, () => element.render());
    await viewer.updateComplete;
    const blocks = [...viewer.shadowRoot!.querySelectorAll('[part="quoted"]')];
    expect(blocks.length).to.equal(128);
    expect(blocks.map((block) => block.textContent!.trim())).to.deep.equal(Array.from({ length: 128 }, (_, index) => `Quoted ${index}`));
    expect(blocks.every((block) => !block.hasAttribute('hidden'))).to.equal(true);
    expect(Array.from(viewer.shadowRoot!.querySelectorAll('[part="quote-toggle"]'), (toggle) => toggle.getAttribute('aria-expanded')))
      .to.deep.equal(Array<string>(128).fill('true'));
    viewer.strings = { emailViewerHideQuoted: 'Hide this quote', emailViewerShowQuoted: 'Show this quote' };
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelector('[part="quote-toggle"]')!.textContent).to.equal('Hide this quote');
    viewer.shadowRoot!.querySelector<HTMLButtonElement>('[data-quote-toggle="7"]')!.click();
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelector('[data-quote-index="7"]')!.hasAttribute('hidden')).to.equal(true);
    expect(viewer.shadowRoot!.querySelector('[data-quote-toggle="7"]')!.textContent).to.equal('Show this quote');
    expect(viewer.shadowRoot!.querySelector('[data-quote-index="8"]')!.hasAttribute('hidden')).to.equal(false);
    const cached = measureArrayProbeReads((array) => array === seam.expandedHtmlQuoteIndices, () => element.render());
    expect(cached.reads).to.equal(0);
    expect(measured.reads).to.be.at.most(blocks.length * 4);
  } finally {
    viewer?.remove();
    window.fetch = fetch;
  }
});
