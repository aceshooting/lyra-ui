import { expect, fixture, html } from '@open-wc/testing';
import './scroller.js';
import type { LyraScroller } from './scroller.class.js';

describe('<lyra-scroller>', () => {
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
