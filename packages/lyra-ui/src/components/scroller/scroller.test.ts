import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './scroller.js';
import type { LyraScroller } from './scroller.class.js';

describe('<lyra-scroller>', () => {
  it('reports scroll edges correctly at rest under RTL (CSSOM negative-scrollLeft convention)', async () => {
    const el = await fixture<LyraScroller>(html`
      <lyra-scroller controls dir="rtl" style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lyra-scroller>
    `);
    const previous = el.shadowRoot!.querySelector('[part~="previous"]') as HTMLButtonElement;
    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
    // At rest (scrollLeft === 0), the start (previous) edge has nothing to scroll back to, and the
    // end (next) edge still has the rest of the overflowing content ahead.
    await waitUntil(() => previous.disabled === true, 'previous never disabled at rest');
    expect(next.disabled).to.be.false;
  });

  it('re-observes size changes after being moved in the DOM', async () => {
    const el = await fixture<LyraScroller>(html`<lyra-scroller><span>Content</span></lyra-scroller>`);
    const parent = el.parentElement!;
    expect((el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver).to.exist;

    el.remove();
    expect((el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver).to.be.undefined;
    parent.append(el);

    expect((el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver).to.exist;
  });

  it('renders a labeled native scroll viewport', async () => {
    const el = await fixture<LyraScroller>(html`<lyra-scroller label="Recent items"><span>Content</span></lyra-scroller>`);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('region');
    expect(base.getAttribute('aria-label')).to.equal('Recent items');
    expect(el.shadowRoot!.querySelector('[part="viewport"]')).to.exist;
  });

  it('supports optional navigation controls', async () => {
    const el = await fixture<LyraScroller>(html`<lyra-scroller controls><span>Content</span></lyra-scroller>`);
    expect(el.shadowRoot!.querySelector('[part~="previous"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="next"]')).to.exist;
  });

  it('is accessible', async () => {
    const el = await fixture<LyraScroller>(html`<lyra-scroller label="Recent items"><span>Content</span></lyra-scroller>`);
    await expect(el).to.be.accessible();
  });
});
