import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './svg-viewer.js';
import type { LyraSvgViewer } from './svg-viewer.js';
import { styles } from './svg-viewer.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';

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

describe('lr-svg-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No image to display.');
  });

  it('fetches and sanitizes SVG markup', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<svg><script>alert(1)</script><circle r="2" /></svg>'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-svg-viewer src="https://example.test/a.svg" name="Chart"></lr-svg-viewer>`)) as LyraSvgViewer;
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

  it('forwards a host aria-label to the role="img" content region, winning over the localized default', async () => {
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      const el = (await fixture(
        html`<lr-svg-viewer src="https://example.test/a.svg" aria-label="Revenue trend chart"></lr-svg-viewer>`,
      )) as LyraSvgViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('aria-label')).to.equal('Revenue trend chart');
    } finally {
      restore();
    }
  });

  it('lets an explicit host aria-label win over the name-derived fallback', async () => {
    // Matches pdf-viewer/notebook-viewer/xml-viewer's identical precedence: a consumer-supplied
    // host aria-label overrides an also-set `name`, rather than `name` silently discarding it.
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      const el = (await fixture(
        html`<lr-svg-viewer src="https://example.test/a.svg" name="Chart" aria-label="Revenue trend chart"></lr-svg-viewer>`,
      )) as LyraSvgViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('aria-label')).to.equal('Revenue trend chart');
    } finally {
      restore();
    }
  });

  it('supports a .strings override for the svgViewerLabel fallback', async () => {
    const el = (await fixture(
      html`<lr-svg-viewer .strings=${{ svgViewerLabel: 'Visionneuse SVG' }}></lr-svg-viewer>`,
    )) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/a.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('aria-label')).to.equal('Visionneuse SVG');
    } finally {
      restore();
    }
  });

  it('rejects unsafe URLs and emits render errors for failed fetches', async () => {
    const el = (await fixture(html`<lr-svg-viewer src="javascript:alert(1)"></lr-svg-viewer>`)) as LyraSvgViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Document URL is not allowed.');
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('', false))) as typeof window.fetch;
    try {
      el.src = 'https://example.test/b.svg';
      const eventPromise = oneEvent(el, 'lr-render-error');
      const event = await eventPromise;
      expect(event.detail.error).to.exist;
    } finally {
      window.fetch = original;
    }
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lr-svg-viewer></lr-svg-viewer>`);
    await expect(el).to.be.accessible();
  });

  it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
    // Regression test: updated() previously scheduled the src-triggered load with no super.updated()
    // call at all -- unlike every sibling viewer (csv-viewer, docx-viewer, pdf-viewer), which all
    // chain to LyraElement's own updated(). Monkey-patches the shared prototype (the established
    // pattern, e.g. token-input.test.ts) to prove LyraSvgViewer's own override actually reaches it.
    const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void };
    const original = proto.updated;
    let called = false;
    proto.updated = function (this: LyraElement, changed: PropertyValues): void {
      called = true;
      original.call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
      await el.updateComplete;
      expect(called).to.be.true;
    } finally {
      proto.updated = original;
    }
  });

  it('lets the host shrink below its content in a narrow flex/grid track instead of overflowing it', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    const hostBlock = /:host\s*{([^}]*)}/.exec(css);
    expect(hostBlock, 'expected a :host rule').to.not.equal(null);
    expect(hostBlock![1]).to.include('min-inline-size: 0;');
    expect(hostBlock![1]).to.include('max-inline-size: 100%;');
  });

  it('resolves min-inline-size/max-inline-size as live computed styles on a rendered host, not just stylesheet source text', async () => {
    // Regression test for the same rule the cssText assertion above only proves exists in the
    // stylesheet source -- a typo, or the declaration moving to a selector that no longer matches
    // the host, would not be caught there. getComputedStyle() on an actually-rendered instance
    // proves the rule is live and resolves as specified.
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const computed = getComputedStyle(el);
    expect(computed.minInlineSize).to.equal('0px');
    expect(computed.maxInlineSize).to.equal('100%');
  });

  it('actually shrinks to its allocation and never forces a real narrow grid track to overflow, rendered', async () => {
    // Complements the assertions above (which prove the :host declaration is live but not that
    // the resulting layout behaves) by mounting inside a real, fixed-width CSS grid track with
    // wide fetched SVG content, then measuring actual computed/laid-out geometry -- matching the
    // class doc's "flex/grid track" framing -- instead of only inspecting stylesheet text.
    const wrap = (await fixture(html`
      <div style="display:grid; inline-size:120px; grid-template-columns: 120px;">
        <lr-svg-viewer></lr-svg-viewer>
      </div>
    `)) as HTMLElement;
    const el = wrap.querySelector('lr-svg-viewer') as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/wide.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      await el.updateComplete;
      expect(el.getBoundingClientRect().width).to.be.closeTo(120, 1);
      expect(wrap.scrollWidth).to.equal(wrap.clientWidth);
    } finally {
      restore();
    }
  });
});

describe('zoomable', () => {
  it('does not wrap in lr-zoomable-frame by default', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('lr-zoomable-frame')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('wraps the sanitized svg in lr-zoomable-frame when zoomable is set', async () => {
    const el = (await fixture(html`<lr-svg-viewer zoomable></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      const frame = el.shadowRoot!.querySelector('lr-zoomable-frame');
      expect(frame).to.exist;
      expect(frame!.querySelector('[part="svg"] circle')).to.exist;
    } finally {
      restore();
    }
  });
});

describe('region highlights', () => {
  it('gives the region-highlight part both a :hover and a :focus-visible rule', () => {
    // Regression test: region-highlight is a real interactive control (role=button, tabindex=0,
    // click + Enter/Space handlers) but previously had neither -- a mouse user saw only a static
    // bordered box with a pointer cursor, and a keyboard user tabbing through several highlights got
    // no visible indication of which was focused. getComputedStyle can't synthesize a real :hover
    // state without dispatching pointer events the wtr harness can't simulate, so (matching
    // commit-card.test.ts's identical convention) this asserts against the stylesheet source text.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='region-highlight'\]:hover/);
    expect(css).to.match(/\[part='region-highlight'\]:focus-visible/);
  });

  it('renders a focusable region-highlight positioned by percent-unit rect', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
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
    const el = (await fixture(html`<lr-svg-viewer dir="rtl"></lr-svg-viewer>`)) as LyraSvgViewer;
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

  it('emits lr-highlight-activate on click and Enter', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 0, y: 0, width: 10, height: 10 } } }];
      await el.updateComplete;
      const listener = oneEvent(el, 'lr-highlight-activate');
      (el.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement).click();
      const event = (await listener) as CustomEvent<{ id: string }>;
      expect(event.detail).to.deep.equal({ id: 'h1' });
    } finally {
      restore();
    }
  });

  it('is accessible with zoomable off and a region highlight active', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
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
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
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
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('lr-zoomable-frame')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="highlight-layer"]')).to.not.exist;
    } finally {
      restore();
    }
  });
});

describe('active-region cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraSvgViewer, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function activeRegion(style = ''): Promise<{ el: LyraSvgViewer; region: HTMLElement; restore: () => void }> {
    const wrapper = (await fixture(html`<div style=${style}><lr-svg-viewer></lr-svg-viewer></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-svg-viewer') as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    el.src = 'https://example.test/icon.svg';
    await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
    el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 0, y: 0, width: 10, height: 10 } } }];
    el.activeHighlightId = 'h1';
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('[part="region-highlight"][data-active]') as HTMLElement;
    return { el, region, restore };
  }

  it('recolors the active region border from an ancestor via --lr-svg-viewer-active-border', async () => {
    const { region, restore } = await activeRegion('--lr-svg-viewer-active-border: rgb(0, 51, 102)');
    try {
      expect(getComputedStyle(region).borderTopColor).to.equal('rgb(0, 51, 102)');
    } finally {
      restore();
    }
  });

  it('renders byte-identical to the warning-token fallback chain when unset', async () => {
    const { el, region, restore } = await activeRegion();
    try {
      expect(getComputedStyle(region).borderTopColor).to.equal(
        resolvedInShadow(el, 'border-top-color: var(--lr-color-warning, var(--lr-color-brand))', 'border-top-color'),
      );
    } finally {
      restore();
    }
  });

  it('is accessible with the active-region prop themed', async () => {
    const { el, restore } = await activeRegion('--lr-svg-viewer-active-border: rgb(0, 51, 102)');
    try {
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });
});
