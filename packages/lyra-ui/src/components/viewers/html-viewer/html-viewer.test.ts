import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './html-viewer.js';
import type { LyraHtmlViewer } from './html-viewer.js';
import { __setHtmlSanitizerForTesting } from './dompurify-loader.js';
import { getDefaultDocumentRendererRegistry } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

function response(body: string, ok = true): Response { return { ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Error', text: () => Promise.resolve(body) } as Response; }

describe('lr-html-viewer', () => {
  afterEach(() => __setHtmlSanitizerForTesting(undefined));

  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lr-html-viewer></lr-html-viewer>`)) as LyraHtmlViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.');
  });
  it('fetches and sanitizes HTML markup', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<h1>Safe</h1><script>alert(1)</script>'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-html-viewer src="https://example.test/a.html" name="Report"></lr-html-viewer>`)) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="html"] h1') !== null);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="html"] h1')!.textContent).to.equal('Safe');
      expect(el.shadowRoot!.querySelector('[part="html"] script')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="html"]')!.getAttribute('aria-label')).to.equal('Report');
    } finally { window.fetch = original; }
  });
  it('contains fixed-position sanitized content without changing ordinary inline formatting', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response(`
      <span data-fixed style="position:fixed;inset:0;z-index:2147483647">Overlay</span>
      <p>Ordinary <strong data-inline>inline text</strong>.</p>
    `))) as typeof window.fetch;
    try {
      const el = (await fixture(html`
        <lr-html-viewer
          style="inline-size:240px"
          src="https://example.test/contained.html"
        ></lr-html-viewer>
      `)) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[data-fixed]') !== null);
      const surface = el.shadowRoot!.querySelector('[part="html"]') as HTMLElement;
      const fixed = surface.querySelector('[data-fixed]') as HTMLElement;
      const inline = surface.querySelector('[data-inline]') as HTMLElement;
      const surfaceRect = surface.getBoundingClientRect();
      const fixedRect = fixed.getBoundingClientRect();

      expect(getComputedStyle(surface).contain).to.equal('paint');
      expect(fixedRect.left).to.be.at.least(surfaceRect.left);
      expect(fixedRect.right).to.be.at.most(surfaceRect.right);
      expect(getComputedStyle(inline).display).to.equal('inline');
    } finally {
      window.fetch = original;
    }
  });
  it('forwards a host aria-label to the role="document" content region, winning over the localized default', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>Safe</p>'))) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-html-viewer src="https://example.test/a.html" aria-label="Q3 report"></lr-html-viewer>`,
      )) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="html"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="html"]')!.getAttribute('aria-label')).to.equal('Q3 report');
    } finally { window.fetch = original; }
  });
  it('lets a host aria-label override the name property and localized default', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>Safe</p>'))) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-html-viewer src="https://example.test/a.html" name="Named report" aria-label="Q3 report"></lr-html-viewer>`,
      )) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="html"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="html"]')!.getAttribute('aria-label')).to.equal('Q3 report');
    } finally { window.fetch = original; }
  });
  it('rejects unsafe URLs and emits lr-render-error with a rendered failure message for a failed fetch', async () => {
    const el = (await fixture(html`<lr-html-viewer></lr-html-viewer>`)) as LyraHtmlViewer;
    const unsafeEvent = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    expect((await unsafeEvent).detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    expect(el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length).to.equal(0);
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('', false))) as typeof window.fetch;
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/b.html';
      const event = await eventPromise;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
    } finally { window.fetch = original; }
  });
  it('reloads the same HTML source after a disconnect/reconnect', async () => {
    const original = window.fetch;
    let fetchCount = 0;
    window.fetch = (() => {
      fetchCount++;
      return Promise.resolve(response(`<p>load ${fetchCount}</p>`));
    }) as typeof window.fetch;
    try {
      const el = (await fixture(html`
        <lr-html-viewer src="https://example.test/a.html"></lr-html-viewer>
      `)) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="html"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await aTimeout(20);
      expect(fetchCount).to.equal(2);
      expect(el.shadowRoot!.querySelector('[part="html"]')!.textContent).to.equal('load 2');
    } finally {
      window.fetch = original;
    }
  });
  it('shows a localized missing-sanitizer error instead of a silently empty document when the optional dompurify peer is unavailable', async () => {
    __setHtmlSanitizerForTesting(null);
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>Safe</p>'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-html-viewer src="https://example.test/c.html"></lr-html-viewer>`)) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "dompurify" package installed to render safely.',
      );
      expect(el.shadowRoot!.querySelector('[part="html"]')).to.not.exist;
    } finally { window.fetch = original; }
  });
  it('renders a .strings override for the empty-state message', async () => {
    const el = (await fixture(
      html`<lr-html-viewer .strings=${{ documentPreviewEmpty: 'Aucun {type} à afficher.' }}></lr-html-viewer>`,
    )) as LyraHtmlViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('Aucun document à afficher.');
  });
  it('is accessible', async () => { const el = await fixture(html`<lr-html-viewer></lr-html-viewer>`); await expect(el).to.be.accessible(); });
  it('is accessible once real sanitized HTML content is loaded', async () => {
    const original = window.fetch;
    window.fetch = (() =>
      Promise.resolve(response('<h1>Report</h1><p>Some <a href="https://example.test">text</a>.</p>'))) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-html-viewer src="https://example.test/a.html" name="Report"></lr-html-viewer>`,
      )) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="html"] h1') !== null);
      await expect(el).to.be.accessible();
    } finally { window.fetch = original; }
  });
});

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraHtmlViewer>(html`<lr-html-viewer></lr-html-viewer>`);
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-html-viewer-max-height')).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-html-viewer-max-height')).to.equal('calc(10rem + 2px)');
});

describe('HTML registry', () => {
  it('forwards document anchors/highlights and advertises its text contracts', () => {
    const definition = getDefaultDocumentRendererRegistry().get('text/html')!;
    const highlights: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'Ada' } }];
    const anchor = { kind: 'fragment' as const, id: 'section-one' };
    const rendered = definition.render!({
      name: 'report.html',
      mimeType: 'text/html',
      src: 'https://example.test/report.html',
      anchor,
      highlights,
    }) as LyraHtmlViewer;
    expect(rendered.anchor).to.equal(anchor);
    expect(rendered.highlights).to.equal(highlights);
    expect(definition.capabilities).to.deep.equal({
      anchors: ['text-quote', 'fragment'],
      search: true,
      textSelect: true,
    });
  });
});

// -- Document-renderer registry entry ---------------------------------------

it('registers a text/html renderer whose matches() and render() behave as declared', async () => {
  const { getDefaultDocumentRendererRegistry } = await import('../document-viewer/registry.js');
  const def = getDefaultDocumentRendererRegistry().get('text/html');
  expect(def, 'importing the module registers the renderer').to.exist;
  expect(def!.matches!({ name: 'page.HTML', mimeType: 'text/html', src: 'https://example.test/f' }), 'page.HTML').to.be.true;
  expect(def!.matches!({ name: 'page.htm', mimeType: 'text/html', src: 'https://example.test/f' }), 'page.htm').to.be.true;
  expect(def!.matches!({ name: 'page.md', mimeType: 'text/markdown', src: 'https://example.test/f' }), 'page.md').to.be.false;
  expect(def!.capabilities, 'capabilities are declared for host feature-detection').to.exist;

  const host = (await fixture(html`<div>${def!.render!({
    name: 'page.HTML', mimeType: 'text/html', src: 'https://example.test/f',
  })}</div>`)) as HTMLElement;
  expect(host.querySelector('lr-html-viewer'), 'render() produces the viewer element').to.exist;
});
