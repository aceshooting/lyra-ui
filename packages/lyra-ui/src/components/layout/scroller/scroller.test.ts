import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './scroller.js';
import type { LyraScroller } from './scroller.class.js';
import { styles } from './scroller.styles.js';

describe('<lr-scroller>', () => {
  it('reports scroll edges correctly at rest under RTL (CSSOM negative-scrollLeft convention)', async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls dir="rtl" style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lr-scroller>
    `);
    const previous = el.shadowRoot!.querySelector('[part~="previous"]') as HTMLButtonElement;
    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
    // At rest (scrollLeft === 0), the start (previous) edge has nothing to scroll back to, and the
    // end (next) edge still has the rest of the overflowing content ahead.
    await waitUntil(() => previous.disabled === true, 'previous never disabled at rest');
    expect(next.disabled).to.be.false;
  });

  it('re-observes size changes after being moved in the DOM', async () => {
    const el = await fixture<LyraScroller>(html`<lr-scroller><span>Content</span></lr-scroller>`);
    const parent = el.parentElement!;
    expect((el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver).to.exist;

    el.remove();
    expect((el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver).to.be.undefined;
    parent.append(el);

    expect((el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver).to.exist;
  });

  it('renders a labeled native scroll viewport', async () => {
    const el = await fixture<LyraScroller>(html`<lr-scroller label="Recent items"><span>Content</span></lr-scroller>`);
    // The role and accessible name live on [part="viewport"] — the element that
    // actually scrolls and carries tabindex="0" — so the keyboard tab stop is a
    // named region (same placement as lr-terminal's scrollable viewport), not
    // an unnamed focusable inside a labeled wrapper.
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
    expect(viewport.getAttribute('role')).to.equal('region');
    expect(viewport.getAttribute('aria-label')).to.equal('Recent items');
    expect(viewport.getAttribute('tabindex')).to.equal('0');
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('role')).to.be.false;
  });

  it('supports optional navigation controls', async () => {
    const el = await fixture<LyraScroller>(html`<lr-scroller controls><span>Content</span></lr-scroller>`);
    expect(el.shadowRoot!.querySelector('[part~="previous"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="next"]')).to.exist;
  });

  it('wraps the horizontal chevrons in documented previous-glyph/next-glyph parts', async () => {
    const el = await fixture<LyraScroller>(html`<lr-scroller controls><span>Content</span></lr-scroller>`);
    const previousGlyph = el.shadowRoot!.querySelector('[part="previous-glyph"]')!;
    const nextGlyph = el.shadowRoot!.querySelector('[part="next-glyph"]')!;
    expect(previousGlyph).to.exist;
    expect(previousGlyph.getAttribute('aria-hidden')).to.equal('true');
    expect(previousGlyph.textContent).to.equal('‹');
    expect(nextGlyph).to.exist;
    expect(nextGlyph.getAttribute('aria-hidden')).to.equal('true');
    expect(nextGlyph.textContent).to.equal('›');
  });

  it('wraps the vertical-orientation glyphs in the same previous-glyph/next-glyph parts as horizontal, not bare text', async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller controls orientation="vertical"><span>Content</span></lr-scroller>`,
    );
    const previousGlyph = el.shadowRoot!.querySelector('[part="previous-glyph"]')!;
    const nextGlyph = el.shadowRoot!.querySelector('[part="next-glyph"]')!;
    expect(previousGlyph).to.exist;
    expect(previousGlyph.getAttribute('aria-hidden')).to.equal('true');
    expect(previousGlyph.textContent).to.equal('↑');
    expect(nextGlyph).to.exist;
    expect(nextGlyph.getAttribute('aria-hidden')).to.equal('true');
    expect(nextGlyph.textContent).to.equal('↓');
  });

  it('gives the previous/next controls the shared minimum hit area', async () => {
    const el = await fixture<LyraScroller>(html`<lr-scroller controls><span>Content</span></lr-scroller>`);
    const previous = el.shadowRoot!.querySelector('[part~="previous"]') as HTMLElement;
    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLElement;

    expect(getComputedStyle(previous).minInlineSize).to.equal('40px');
    expect(getComputedStyle(previous).minBlockSize).to.equal('40px');
    expect(getComputedStyle(next).minInlineSize).to.equal('40px');
    expect(getComputedStyle(next).minBlockSize).to.equal('40px');
  });

  it('is accessible', async () => {
    const el = await fixture<LyraScroller>(html`<lr-scroller label="Recent items"><span>Content</span></lr-scroller>`);
    await expect(el).to.be.accessible();
  });

  // -- numeric guard regressions (scrollStep) --

  it('falls back to the viewport-percentage default instead of scrolling by NaN/Infinity when scrollStep is invalid', async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const scrollBySpy: number[] = [];
    viewport.scrollBy = ((opts: ScrollToOptions) => {
      scrollBySpy.push(opts.left ?? 0);
    }) as typeof viewport.scrollBy;

    for (const scrollStep of [NaN, Infinity, -50]) {
      (el as unknown as { scrollStep: number }).scrollStep = scrollStep;
      const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
      next.click();
    }

    // Every call must fall through to the finite viewport-percentage default (80px for a 100px-wide
    // viewport) -- never a NaN/Infinity/negative `left` reaching the real scrollBy().
    expect(scrollBySpy).to.have.lengthOf(3);
    for (const left of scrollBySpy) {
      expect(Number.isFinite(left), String(left)).to.be.true;
      expect(left).to.be.greaterThan(0);
    }
  });

  it('honors a valid positive scrollStep as an explicit override amount', async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls scroll-step="42" style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    let capturedLeft: number | undefined;
    viewport.scrollBy = ((opts: ScrollToOptions) => {
      capturedLeft = opts.left;
    }) as typeof viewport.scrollBy;

    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
    next.click();

    expect(capturedLeft).to.equal(42);
  });

  it('gives control a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='control'\]:hover/);
  });
});
