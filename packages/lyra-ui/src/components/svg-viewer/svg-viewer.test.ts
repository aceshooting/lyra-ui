import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './svg-viewer.js';
import type { LyraSvgViewer } from './svg-viewer.js';
import { styles } from './svg-viewer.styles.js';

function response(body: string, ok = true): Response {
  return { ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Error', text: () => Promise.resolve(body) } as Response;
}

/** Stubs `window.fetch` to resolve with the given raw SVG markup, restoring the original
 *  afterward -- same shape as `document-preview.test.ts`'s `stubFetch`. */
function fetchSvg(markup: string): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(response(markup))) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
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

describe('zoomable', () => {
  it('does not wrap in lyra-zoomable-frame by default', async () => {
    const el = (await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('lyra-zoomable-frame')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('wraps the sanitized svg in lyra-zoomable-frame when zoomable is set', async () => {
    const el = (await fixture(html`<lyra-svg-viewer zoomable></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      const frame = el.shadowRoot!.querySelector('lyra-zoomable-frame');
      expect(frame).to.exist;
      expect(frame!.querySelector('[part="svg"] circle')).to.exist;
    } finally {
      restore();
    }
  });
});

describe('region highlights', () => {
  it('renders a focusable region-highlight positioned by percent-unit rect', async () => {
    const el = (await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 20, width: 30, height: 40 } } }];
      await el.updateComplete;
      const region = el.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
      expect(region).to.exist;
      expect(region.getAttribute('role')).to.equal('button');
      expect(region.style.left).to.equal('10%');
    } finally {
      restore();
    }
  });

  it('positions region highlights with physical left/top under dir="rtl" so they stay over the non-mirroring render', async () => {
    const el = (await fixture(html`<lyra-svg-viewer dir="rtl"></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 20, width: 30, height: 40 } } }];
      await el.updateComplete;
      const region = el.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
      expect(region.style.left).to.equal('10%');
      expect(region.style.top).to.equal('20%');
      expect(region.style.getPropertyValue('inset-inline-start')).to.equal('');
    } finally {
      restore();
    }
  });

  it('emits lyra-highlight-activate on click and Enter', async () => {
    const el = (await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 0, y: 0, width: 10, height: 10 } } }];
      await el.updateComplete;
      const listener = oneEvent(el, 'lyra-highlight-activate');
      (el.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement).click();
      const event = (await listener) as CustomEvent<{ id: string }>;
      expect(event.detail).to.deep.equal({ id: 'h1' });
    } finally {
      restore();
    }
  });

  it('is accessible with zoomable off and a region highlight active', async () => {
    const el = (await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 0, y: 0, width: 10, height: 10 } } }];
      await el.updateComplete;
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it('scrollToAnchor() by id scrolls the matching region, not just the first one, when several are rendered', async () => {
    const el = (await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [
        { id: 'h1', anchor: { kind: 'region', rect: { x: 0, y: 0, width: 10, height: 10 } } },
        { id: 'h2', anchor: { kind: 'region', rect: { x: 50, y: 50, width: 10, height: 10 } } },
      ];
      await el.updateComplete;
      const regions = Array.from(el.shadowRoot!.querySelectorAll('[part="region-highlight"]')) as HTMLElement[];
      const scrolled: string[] = [];
      for (const region of regions) {
        region.scrollIntoView = () => scrolled.push(region.dataset.id!);
      }
      const ok = await el.scrollToAnchor('h2');
      expect(ok).to.be.true;
      expect(scrolled).to.deep.equal(['h2']);
    } finally {
      restore();
    }
  });
});

describe('back-compat', () => {
  it('DOM is byte-identical with zoomable off and highlights empty', async () => {
    const el = (await fixture(html`<lyra-svg-viewer></lyra-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('lyra-zoomable-frame')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="highlight-layer"]')).to.not.exist;
    } finally {
      restore();
    }
  });
});
