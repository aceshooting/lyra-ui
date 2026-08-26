import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './svg-viewer.js';
import type { LyraSvgViewer } from './svg-viewer.js';
import { styles } from './svg-viewer.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

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

/** Shrinks `DocumentAnchorTarget`'s retry loop so a permanently-unresolvable `scrollToAnchor()`
 *  call resolves in milliseconds instead of waiting out the real 5s default timeout -- same
 *  pattern as csv-viewer.test.ts/pdf-viewer.test.ts. */
function shrinkAnchorRetry(el: LyraSvgViewer): void {
  (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 200;
  (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
}

describe('lr-svg-viewer', () => {
  it('renders its empty state from the first update when a highlight omits its anchor', async () => {
    const el = document.createElement('lr-svg-viewer') as LyraSvgViewer;
    el.highlights = [{ id: 'missing-anchor' }] as unknown as LyraSvgViewer['highlights'];
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.highlights.map((highlight) => highlight.id)).to.deep.equal([]);
      expect(el.shadowRoot!.querySelectorAll('[part~="base"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelector('.empty-note')?.textContent).to.equal(
        'No image to display.',
      );
    } finally {
      el.remove();
    }
  });

  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No image to display.');
  });

  it('keeps rendering its base and empty note when an idle assignment carries a missing or malformed anchor', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;

    el.highlights = [{ id: 'c1', label: 'Source 1' }, { id: 'c2', anchor: null }] as unknown as LyraSvgViewer['highlights'];
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part~="base"]')).to.exist;
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
      expect(el.shadowRoot!.querySelector('[part="svg"]') !== null).to.be.true;
      expect(el.shadowRoot!.querySelector('script') === null).to.be.true;
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Chart');
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('img');
      expect(el.shadowRoot!.querySelector('[part="svg"]')!.hasAttribute('role')).to.be.false;
    } finally {
      window.fetch = original;
    }
  });

  it('fails closed when sanitization does not yield an SVG document', async () => {
    const restore = fetchSvg('<div>not an SVG document</div>');
    try {
      const el = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
      const failure = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/not-svg.svg';
      const event = await failure;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);

      expect((event.detail.error as Error).message)
        .to.equal('SVG sanitizer did not return an SVG document.');
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent)
        .to.equal('Failed to load document.');
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role'))
        .to.equal('region');
      expect(el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]'))
        .to.have.lengthOf(0);
    } finally {
      restore();
    }
  });

  it('removes stylesheet and external resource references while preserving local SVG references', async () => {
    const restore = fetchSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="paint"><stop offset="1" stop-color="red" /></linearGradient>
        </defs>
        <style>:host { position: fixed; inset: 0 } image { filter: url(https://example.test/filter.svg#x) }</style>
        <image id="remote-image" href="https://example.test/tracker.png" />
        <image id="inline-image" href="data:image/png;base64,AA==" />
        <rect id="remote-paint" fill="url(https://example.test/paint.svg#gradient)" />
        <rect id="local-paint" fill="url(#paint)" />
        <circle id="inline-style" style="fill:url(https://example.test/paint.svg#gradient)" />
      </svg>
    `);
    try {
      const el = await fixture<LyraSvgViewer>(html`
        <lr-svg-viewer src="https://example.test/a.svg"></lr-svg-viewer>
      `);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"] svg') !== null);
      const content = el.shadowRoot!.querySelector('[part="svg"]')!;
      expect(content.querySelectorAll('style').length).to.equal(0);
      expect(content.querySelector('#remote-image')?.hasAttribute('href')).to.be.false;
      expect(content.querySelector('#inline-image')?.getAttribute('href')).to.equal('data:image/png;base64,AA==');
      expect(content.querySelector('#remote-paint')?.hasAttribute('fill')).to.be.false;
      expect(content.querySelector('#inline-style')?.hasAttribute('style')).to.be.false;
      expect(content.querySelector('#local-paint')?.getAttribute('fill')).to.equal('url(#paint)');
      expect(getComputedStyle(el).position).to.not.equal('fixed');
    } finally {
      restore();
    }
  });

  it('leaves a non-empty host aria-label on the host instead of duplicating the image owner', async () => {
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      const el = (await fixture(
        html`<lr-svg-viewer src="https://example.test/a.svg" aria-label="Revenue trend chart"></lr-svg-viewer>`,
      )) as LyraSvgViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      expect(base.getAttribute('aria-label')).to.be.null;
      expect(base.getAttribute('role')).to.be.null;
      expect(el.shadowRoot!.querySelector('[part="svg"]')!.hasAttribute('role')).to.be.false;
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
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.be.null;
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.be.null;
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
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse SVG');
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('img');
    } finally {
      restore();
    }
  });

  it('preserves an explicitly empty host aria-label on the idle-state region owner', async () => {
    const el = await fixture<LyraSvgViewer>(
      html`<lr-svg-viewer name="Chart" aria-label=""></lr-svg-viewer>`,
    );
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('region');
    expect(base.hasAttribute('aria-label')).to.be.true;
    expect(base.getAttribute('aria-label')).to.equal('');
  });

  it('rejects unsafe URLs and emits render errors for failed fetches', async () => {
    const el = (await fixture(html`<lr-svg-viewer src="javascript:alert(1)"></lr-svg-viewer>`)) as LyraSvgViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    expect(el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length).to.equal(0);
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

  it('emits exactly one render error for an unsafe URL', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    let count = 0;
    el.addEventListener('lr-render-error', () => { count++; });
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await eventPromise;
    await el.updateComplete;
    expect(count).to.equal(1);
  });

  it('reloads the same SVG source after a disconnect/reconnect', async () => {
    const original = window.fetch;
    let fetchCount = 0;
    window.fetch = (() => {
      fetchCount++;
      return Promise.resolve(response('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    }) as typeof window.fetch;
    try {
      const el = (await fixture(html`
        <lr-svg-viewer src="https://example.test/a.svg"></lr-svg-viewer>
      `)) as LyraSvgViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => fetchCount === 2);
      expect(el.shadowRoot!.querySelector('[part="svg"]') !== null).to.be.true;
    } finally {
      window.fetch = original;
    }
  });

  it('ignores a stale response body after a newer SVG has rendered', async () => {
    const original = window.fetch;
    let staleReadStarted = false;
    let resolveStale!: (value: string) => void;
    window.fetch = ((url: RequestInfo | URL) => {
      const body = String(url).includes('stale')
        ? new Promise<string>((resolve) => {
            staleReadStarted = true;
            resolveStale = resolve;
          })
        : Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"><circle id="fresh" /></svg>');
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => body,
      } as Response);
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
      el.src = 'https://example.test/stale.svg';
      await waitUntil(() => staleReadStarted);
      el.src = 'https://example.test/fresh.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('#fresh') !== null);

      resolveStale('<svg xmlns="http://www.w3.org/2000/svg"><circle id="stale" /></svg>');
      await aTimeout(0);

      expect(el.shadowRoot!.querySelector('#fresh') !== null).to.equal(true);
      expect(el.shadowRoot!.querySelector('#stale') === null).to.equal(true);
    } finally {
      window.fetch = original;
    }
  });

  it('loads without a signal when AbortController is unavailable', async () => {
    const originalAbortController = globalThis.AbortController;
    const originalFetch = window.fetch;
    let observedSignal: AbortSignal | null | undefined = null;
    globalThis.AbortController = undefined as unknown as typeof AbortController;
    window.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => {
      observedSignal = init?.signal;
      return Promise.resolve(response('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
      el.src = 'https://example.test/no-abort-controller.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(observedSignal).to.equal(undefined);
    } finally {
      window.fetch = originalFetch;
      globalThis.AbortController = originalAbortController;
    }
  });

  it('keeps visible busy paint through a reload and removes it on error', async () => {
    const original = window.fetch;
    let call = 0;
    let rejectReload!: (error: unknown) => void;
    window.fetch = (() => {
      call++;
      if (call === 1) return Promise.resolve(response('<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>'));
      return new Promise<Response>((_resolve, reject) => { rejectReload = reject; });
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
      el.src = 'https://example.test/first.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.src = 'https://example.test/reload.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="spinner"]') !== null);
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const label = el.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-label')!;
      expect(base.getAttribute('aria-busy')).to.equal('true');
      expect(label.textContent).to.equal('Loading document…');
      expect(label.getBoundingClientRect().height).to.be.greaterThan(0);
      rejectReload(new Error('offline'));
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(base.getAttribute('aria-busy')).to.equal('false');
      expect(el.shadowRoot!.querySelector('[part="spinner"]') === null).to.equal(true);
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

  it('declares the host shrinkability contract on the :host rule', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    const hostBlock = /:host\s*{([^}]*)}/.exec(css);
    expect(hostBlock, 'expected a :host rule').to.not.equal(null);
    expect(hostBlock![1]).to.include('min-inline-size: 0;');
    expect(hostBlock![1]).to.include('max-inline-size: 100%;');
  });

  it('resolves min-inline-size/max-inline-size as live computed styles on a rendered host, not just stylesheet source text', async () => {
    // Regression test for the same declarations the source assertion above only proves exist in the
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

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-svg-viewer-max-height')).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-svg-viewer-max-height')).to.equal('calc(10rem + 2px)');
});

it('filters invalid public region rectangles before rendering highlight geometry', async () => {
  const el = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
  el.highlights = [
    {
      id: 'unsafe',
      anchor: { kind: 'region', rect: { x: 0, y: 0, width: -1, height: 10 } },
    },
    {
      id: 'safe',
      anchor: { kind: 'region', rect: { x: 10, y: 20, width: 30, height: 40 } },
    },
  ];
  const highlights = (
    el as unknown as { regionHighlights(): Array<{ id: string }> }
  ).regionHighlights();
  expect(highlights.map((highlight) => highlight.id)).to.deep.equal(['safe']);
});

describe('zoomable', () => {
  it('does not wrap in lr-pan-zoom by default', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('lr-pan-zoom') === null).to.be.true;
    } finally {
      restore();
    }
  });

  it('wraps the sanitized svg in lr-pan-zoom when zoomable is set', async () => {
    const el = (await fixture(html`<lr-svg-viewer zoomable></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      const frame = el.shadowRoot!.querySelector('lr-pan-zoom');
      expect(frame).to.exist;
      expect(frame!.querySelector('[part="svg"] circle') !== null).to.be.true;
    } finally {
      restore();
    }
  });

  it('does not expose the internal pan-zoom event', async () => {
    const el = (await fixture(html`<lr-svg-viewer zoomable></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-pan-zoom') !== null);
      let leaked = 0;
      el.addEventListener('lr-zoom-change', () => leaked++);
      el.shadowRoot!.querySelector('lr-pan-zoom')!.dispatchEvent(new CustomEvent(
        'lr-zoom-change',
        { detail: { zoom: 2 }, bubbles: true, composed: true },
      ));
      expect(leaked).to.equal(0);
    } finally {
      restore();
    }
  });
});

describe('region highlights', () => {
  it('keeps a small visual border while exposing a separate minimum activation target', async () => {
    const el = (await fixture(html`
      <lr-svg-viewer style="--lr-icon-button-size:44px"></lr-svg-viewer>
    `)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [
        { id: 'small', anchor: { kind: 'region', rect: { x: 50, y: 50, width: 5, height: 5 } } },
      ];
      await el.updateComplete;
      const content = el.shadowRoot!.querySelector('.zoom-content') as HTMLElement;
      content.style.width = '200px';
      content.style.height = '200px';
      const visual = el.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
      const target = el.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLElement;
      expect(target !== null).to.be.true;
      const visualBox = visual.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      expect(visualBox.width).to.be.lessThan(20);
      expect(visualBox.height).to.be.lessThan(20);
      expect(targetBox.width).to.be.at.least(44);
      expect(targetBox.height).to.be.at.least(44);
      expect(visualBox.width).to.be.lessThan(targetBox.width);
      expect(visualBox.height).to.be.lessThan(targetBox.height);
      const hit = el.shadowRoot!.elementFromPoint(
        targetBox.left + targetBox.width - 2,
        targetBox.top + targetBox.height / 2,
      ) as HTMLElement | null;
      expect(hit?.dataset['highlightId']).to.equal('small');
    } finally {
      restore();
    }
  });

  it('paints a rendered hover treatment on the region-highlight target', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 20, y: 20, width: 20, height: 20 } } }];
      await el.updateComplete;
      const target = el.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLElement;
      const region = el.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
      const before = getComputedStyle(region).backgroundColor;
      const rect = target.getBoundingClientRect();
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      expect(getComputedStyle(region).backgroundColor).to.not.equal(before);
    } finally {
      await resetMouse();
      restore();
    }
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
      const target = el.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLElement;
      expect((region) != null).to.equal(true);
      expect(target.getAttribute('role')).to.equal('button');
      expect(region.style.left).to.equal('10%');
    } finally {
      restore();
    }
  });

  it('uses a non-overlapping action list for multiple dense highlights', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [
        { id: 'a', label: 'First', anchor: { kind: 'region', rect: { x: 50, y: 50, width: 1, height: 1 } } },
        { id: 'b', label: 'Second', anchor: { kind: 'region', rect: { x: 51, y: 50, width: 1, height: 1 } } },
      ];
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="region-highlight-target"]').length).to.equal(0);
      const actions = [...el.shadowRoot!.querySelectorAll('[part="region-highlight-action"]')] as HTMLElement[];
      expect(actions.length).to.equal(2);
      const first = actions[0]!.getBoundingClientRect();
      const second = actions[1]!.getBoundingClientRect();
      expect(first.bottom).to.be.at.most(second.top);
    } finally {
      restore();
    }
  });

  it('honors the composite focus-ring shorthand on rendered region targets and actions', async () => {
    const el = await fixture<LyraSvgViewer>(html`
      <lr-svg-viewer style="--lr-focus-ring: 5px dashed rgb(1, 2, 3)"></lr-svg-viewer>
    `);
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [
        { id: 'target', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 20 } } },
      ];
      await el.updateComplete;
      const target = el.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLElement;
      target.focus();
      expect(target.matches(':focus-visible')).to.equal(true);
      let computed = getComputedStyle(target);
      expect(computed.outlineStyle).to.equal('dashed');
      expect(computed.outlineWidth).to.equal('5px');
      expect(computed.outlineColor).to.equal('rgb(1, 2, 3)');

      el.highlights = [
        { id: 'a', anchor: { kind: 'region', rect: { x: 50, y: 50, width: 1, height: 1 } } },
        { id: 'b', anchor: { kind: 'region', rect: { x: 51, y: 50, width: 1, height: 1 } } },
      ];
      await el.updateComplete;
      const action = el.shadowRoot!.querySelector('[part="region-highlight-action"]') as HTMLElement;
      action.focus();
      expect(action.matches(':focus-visible')).to.equal(true);
      computed = getComputedStyle(action);
      expect(computed.outlineStyle).to.equal('dashed');
      expect(computed.outlineWidth).to.equal('5px');
      expect(computed.outlineColor).to.equal('rgb(1, 2, 3)');
    } finally {
      restore();
    }
  });

  it('gives unlabeled dense highlight actions distinct ordinal names', async () => {
    const el = await fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`);
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [
        { id: 'a', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 2, height: 2 } } },
        { id: 'b', anchor: { kind: 'region', rect: { x: 20, y: 20, width: 2, height: 2 } } },
      ];
      await el.updateComplete;
      const names = [...el.shadowRoot!.querySelectorAll('[part="region-highlight-action"]')]
        .map((action) => action.getAttribute('aria-label'));
      expect(names).to.deep.equal(['Highlight 1 of 2', 'Highlight 2 of 2']);
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
      (el.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLElement).click();
      const event = (await listener) as CustomEvent<{ highlightId: string }>;
      expect(event.detail).to.deep.equal({ highlightId: 'h1' });
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
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('region');
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it('bounds painted regions while retaining an active highlight beyond the candidate cap', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = Array.from({ length: 1_001 }, (_, index) => ({
        id: `h${index}`,
        anchor: {
          kind: 'region' as const,
          rect: { x: index % 100, y: index % 100, width: 1, height: 1 },
        },
      }));
      el.activeHighlightId = 'h1000';
      await el.updateComplete;

      expect(el.shadowRoot!.querySelectorAll('[part="region-highlight"]').length).to.equal(100);
      expect(el.shadowRoot!.querySelector('[part="region-highlight"][data-id="h1000"][data-active]') !== null).to.be.true;
      expect(el.shadowRoot!.querySelector('[part="region-highlight"][data-id="h99"]') === null).to.be.true;
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
        { id: 'h2', anchor: { kind: 'region', page: 1, rect: { x: 50, y: 50, width: 10, height: 10 } } },
      ];
      await el.updateComplete;
      const regions = Array.from(el.shadowRoot!.querySelectorAll('[part="region-highlight"]')) as HTMLElement[];
      const scrolled: string[] = [];
      for (const region of regions) {
        region.scrollIntoView = () => scrolled.push(region.dataset['id']!);
      }
      const ok = await el.scrollToAnchor('h2');
      expect(ok).to.be.true;
      expect(scrolled).to.deep.equal(['h2']);
    } finally {
      restore();
    }
  });

  it('matches equal region anchors structurally and does not claim an unmatched anchor', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    shrinkAnchorRetry(el);
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      el.highlights = [
        { id: 'h1', anchor: { kind: 'region', rect: { x: 0, y: 0, width: 10, height: 10 } } },
        { id: 'h2', anchor: { kind: 'region', page: 1, rect: { x: 50, y: 50, width: 10, height: 10 } } },
      ];
      await el.updateComplete;
      const regions = Array.from(el.shadowRoot!.querySelectorAll('[part="region-highlight"]')) as HTMLElement[];
      const scrolled: string[] = [];
      for (const region of regions) region.scrollIntoView = () => scrolled.push(region.dataset['id']!);

      expect(
        await el.scrollToAnchor({ kind: 'region', page: 1, rect: { x: 50, y: 50, width: 10, height: 10 } }),
      ).to.be.true;
      expect(scrolled).to.deep.equal(['h2']);
      scrolled.length = 0;
      expect(
        await el.scrollToAnchor({ kind: 'region', rect: { x: 90, y: 90, width: 5, height: 5 } }),
      ).to.be.false;
      expect(scrolled).to.deep.equal([]);
      expect(
        await el.scrollToAnchor({ kind: 'region', page: 2, rect: { x: 50, y: 50, width: 10, height: 10 } }),
      ).to.be.false;
      expect(scrolled).to.deep.equal([]);
    } finally {
      restore();
    }
  });

  it('maps each public highlight tone to its semantic border color', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      const tones = ['accent', 'success', 'warning', 'danger', 'neutral'] as const;
      el.highlights = tones.map((tone, index) => ({
        id: tone,
        tone,
        anchor: { kind: 'region', rect: { x: index * 10, y: 0, width: 5, height: 5 } },
      }));
      await el.updateComplete;
      const tokenByTone = {
        accent: '--lr-color-brand',
        success: '--lr-color-success',
        warning: '--lr-color-warning',
        danger: '--lr-color-danger',
        neutral: '--lr-color-neutral',
      };
      for (const tone of tones) {
        const region = el.shadowRoot!.querySelector(`[data-id="${tone}"]`) as HTMLElement;
        const probe = document.createElement('span');
        probe.style.color = `var(${tokenByTone[tone]})`;
        el.shadowRoot!.append(probe);
        expect(getComputedStyle(region).borderTopColor).to.equal(getComputedStyle(probe).color);
        probe.remove();
      }
    } finally {
      restore();
    }
  });
});

describe('anchor-target adoption', () => {
  it('exposes anchorKinds and defaults highlights/activeHighlightId/anchor', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    expect(el.anchorKinds).to.deep.equal(['region']);
    expect(el.highlights).to.deep.equal([]);
    expect(el.activeHighlightId).to.be.null;
    expect(el.anchor).to.be.null;
  });

  it('still parses the active-highlight-id content attribute after the move to DocumentAnchorTarget', async () => {
    // `activeHighlightId` moved from a locally-declared @property into the shared mixin. `cem`
    // cannot see mixin-declared reactive properties, so `active-highlight-id` disappeared from this
    // tag's custom-elements.json `attributes` list (exactly as it is already absent for the two
    // sibling adopters, lr-pdf-viewer and lr-csv-viewer). That is a manifest-analyzer blind spot,
    // NOT a runtime removal -- pinned here so a real regression can't hide behind the same
    // manifest shape.
    const el = (await fixture(
      html`<lr-svg-viewer active-highlight-id="h1"></lr-svg-viewer>`,
    )) as LyraSvgViewer;
    expect(el.activeHighlightId).to.equal('h1');
    el.setAttribute('active-highlight-id', 'h2');
    await el.updateComplete;
    expect(el.activeHighlightId).to.equal('h2');
  });

  it('scrolls a declaratively-set anchor into view once the region has rendered, emitting lr-anchor-result', async () => {
    // Regression test: before this fix LyraSvgViewer declared no `anchor` @property at all, so
    // `element.anchor = ...` was inert -- no Lit reactivity, no scrollToAnchor() call, and
    // lr-anchor-result never fired.
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    shrinkAnchorRetry(el);
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    let scrolledId: string | null = null;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolledId = this.dataset['id'] ?? null;
    };
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.highlights = [{ id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 20, width: 30, height: 40 } } }];
      const eventPromise = oneEvent(el, 'lr-anchor-result');
      el.anchor = { kind: 'region', rect: { x: 10, y: 20, width: 30, height: 40 } };
      el.src = 'https://example.test/icon.svg';
      const event = await eventPromise;
      expect(event.detail).to.deep.equal({ found: true });
      expect(scrolledId).to.equal('h1');
      expect(el.shadowRoot!.querySelector('[part="region-highlight"][data-id="h1"]')).to.exist;
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      restore();
    }
  });

  it('resolves { found: false } via lr-anchor-result for a region anchor matching no highlight', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    shrinkAnchorRetry(el);
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      const eventPromise = oneEvent(el, 'lr-anchor-result');
      el.anchor = { kind: 'region', rect: { x: 90, y: 90, width: 5, height: 5 } };
      const event = await eventPromise;
      expect(event.detail).to.deep.equal({ found: false });
    } finally {
      restore();
    }
  });

  it('keeps the shared anchor live region visually hidden once it carries an announcement', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    await el.scrollToAnchor('no-such-highlight');
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('[part="anchor-live-region"]') as HTMLElement;
    expect(region !== null, 'the mixin live region is rendered').to.equal(true);
    expect(
      (region.textContent ?? '').trim().length,
      'the live region actually carries announcement text',
    ).to.be.greaterThan(0);
    const rect = region.getBoundingClientRect();
    expect(rect.height, 'live-region block size stays clipped to 1px').to.be.at.most(1);
    expect(rect.width, 'live-region inline size stays clipped to 1px').to.be.at.most(1);
  });
});

describe('back-compat', () => {
  it('DOM is byte-identical with zoomable off and highlights empty', async () => {
    const el = (await fixture(html`<lr-svg-viewer></lr-svg-viewer>`)) as LyraSvgViewer;
    const restore = fetchSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    try {
      el.src = 'https://example.test/icon.svg';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="svg"]') !== null);
      expect(el.shadowRoot!.querySelector('lr-pan-zoom') === null).to.be.true;
      expect(el.shadowRoot!.querySelector('[part="highlight-layer"]') === null).to.be.true;
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

// -- Document-renderer registry entry ---------------------------------------

it('registers an image/svg+xml renderer that matches .svg files and renders the viewer', async () => {
  const { getDefaultDocumentRendererRegistry } = await import('../document-viewer/registry.js');
  const def = getDefaultDocumentRendererRegistry().get('image/svg+xml');
  expect(def, 'importing svg-viewer.js registers the renderer').to.exist;
  expect(def!.matches!({ name: 'Diagram.SVG', mimeType: 'image/svg+xml', src: 'https://example.test/a.svg' })).to.be.true;
  expect(def!.matches!({ name: 'diagram.png', mimeType: 'image/png', src: 'https://example.test/a.png' })).to.be.false;
  expect(def!.capabilities).to.deep.equal({ anchors: ['region'], search: false, textSelect: false });

  const host = (await fixture(
    html`<div>${def!.render!({ name: 'a.svg', mimeType: 'image/svg+xml', src: 'https://example.test/a.svg' })}</div>`,
  )) as HTMLElement;
  const viewer = host.querySelector('lr-svg-viewer') as LyraSvgViewer;
  expect(viewer).to.exist;
  expect(viewer.name).to.equal('a.svg');
  expect(viewer.anchor).to.be.null;
  expect(viewer.highlights).to.deep.equal([]);
});
