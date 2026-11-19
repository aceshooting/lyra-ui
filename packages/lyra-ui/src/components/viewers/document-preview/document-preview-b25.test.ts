import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './document-preview.js';
import type { LyraDocumentPreview } from './document-preview.js';

function stubTextFetch(text: string): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(new Response(text, { status: 200 }))) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

describe('lr-document-preview remediation', () => {
  it('shows an error state and emits one render error when the image fails to load', async () => {
    const el = await fixture<LyraDocumentPreview>(html`
      <lr-document-preview mime-type="image/png" src="https://example.invalid/missing.png"></lr-document-preview>
    `);
    let errors = 0;
    el.addEventListener('lr-render-error', () => (errors += 1));
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null, 'no error part rendered');
    await aTimeout(20);
    expect(errors).to.equal(1);
    expect(el.shadowRoot!.querySelector('img')).to.equal(null);
  });

  it('tries a new image src after a failure', async () => {
    const el = await fixture<LyraDocumentPreview>(html`
      <lr-document-preview mime-type="image/png" src="https://example.invalid/missing.png"></lr-document-preview>
    `);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
    el.src = 'https://example.invalid/other.png';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('img')).to.not.equal(null);
  });

  it('isolates caller text direction for the text body and the filename', async () => {
    const restore = stubTextFetch('abc');
    try {
      const el = await fixture<LyraDocumentPreview>(html`
        <lr-document-preview dir="rtl" mime-type="text/plain" filename="report.txt" src="https://example.test/a.txt"></lr-document-preview>
      `);
      await waitUntil(() => el.shadowRoot!.querySelector('pre.text') !== null);
      expect(el.shadowRoot!.querySelector('pre.text')!.getAttribute('dir')).to.equal('auto');
      expect(el.shadowRoot!.querySelector('[part="filename"]')!.getAttribute('dir')).to.equal('auto');
    } finally {
      restore();
    }
  });

  it('makes an overflowing text body keyboard scrollable and leaves a short one alone', async () => {
    const restore = stubTextFetch(Array.from({ length: 80 }, (_unused, i) => `line ${i}`).join('\n'));
    try {
      const el = await fixture<LyraDocumentPreview>(html`
        <lr-document-preview mime-type="text/plain" filename="long.txt" max-height="6rem" src="https://example.test/long.txt"></lr-document-preview>
      `);
      await waitUntil(() => el.shadowRoot!.querySelector('pre.text') !== null);
      const scroller = el.shadowRoot!.querySelector<HTMLElement>('pre.text')!;
      await waitUntil(() => scroller.getAttribute('tabindex') === '0', 'overflowing text never became focusable');
      expect(scroller.getAttribute('role')).to.equal('region');
      expect(scroller.getAttribute('aria-label')).to.equal('long.txt');
      el.maxHeight = '';
      await waitUntil(() => !scroller.hasAttribute('tabindex'), 'text that fits kept its tab stop');
    } finally {
      restore();
    }
  });

  it('keeps the determinate ring thickness on the shared thick border token', async () => {
    const el = await fixture<LyraDocumentPreview>(html`
      <lr-document-preview status="converting" .progress=${40} data-lr-theme-scope style="--lr-theme-border-width-thick: 7px"></lr-document-preview>
    `);
    const ring = el.shadowRoot!.querySelector<HTMLElement>('.ring.determinate')!;
    const style = getComputedStyle(ring);
    const mask = style.maskImage || style.webkitMaskImage || '';
    expect(mask).to.include('7px');
  });
});
