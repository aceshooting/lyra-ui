import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './svg-viewer.js';
import type { LyraSvgViewer } from './svg-viewer.js';
import { styles } from './svg-viewer.styles.js';

function response(body: string, ok = true): Response {
  return { ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Error', text: () => Promise.resolve(body) } as Response;
}

describe('lyra-svg-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`)) as LyraSvgViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No image to display.');
  });

  it('fetches and sanitizes SVG markup', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<svg><script>alert(1)</script><circle r="2" /></svg>'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-svg-viewer src="https://example.test/a.svg" name="Chart"></lyra-svg-viewer>`)) as LyraSvgViewer;
      await aTimeout(20);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="svg"]')).to.exist;
      expect(el.shadowRoot!.querySelector('script')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('aria-label')).to.equal('Chart');
    } finally {
      window.fetch = original;
    }
  });

  it('rejects unsafe URLs and emits render errors for failed fetches', async () => {
    const el = (await fixture(html`<lyra-svg-viewer src="javascript:alert(1)"></lyra-svg-viewer>`)) as LyraSvgViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Document URL is not allowed.');
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('', false))) as typeof window.fetch;
    try {
      el.src = 'https://example.test/b.svg';
      const eventPromise = oneEvent(el, 'lyra-render-error');
      const event = await eventPromise;
      expect(event.detail.error).to.exist;
    } finally {
      window.fetch = original;
    }
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`);
    await expect(el).to.be.accessible();
  });

  it('lets the host shrink below its content in a narrow flex/grid track instead of overflowing it', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    const hostBlock = /:host\s*{([^}]*)}/.exec(css);
    expect(hostBlock, 'expected a :host rule').to.not.equal(null);
    expect(hostBlock![1]).to.include('min-inline-size: 0;');
    expect(hostBlock![1]).to.include('max-inline-size: 100%;');
  });
});
