import { expect, fixture, html } from '@open-wc/testing';
import './intersection-observer.js';
import type { LyraIntersectionObserver } from './intersection-observer.class.js';

describe('<lyra-intersection-observer>', () => {
  it('renders a non-layout observer wrapper', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer><div>Observed</div></lyra-intersection-observer>`);
    expect(getComputedStyle(el).display).to.equal('contents');
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  });

  it('supports root margins and thresholds', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer root-margin="16px"><div>Observed</div></lyra-intersection-observer>`);
    el.threshold = [0, 0.5, 1];
    await el.updateComplete;
    expect(el.rootMargin).to.equal('16px');
    expect(el.threshold).to.deep.equal([0, 0.5, 1]);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer><button>Observed</button></lyra-intersection-observer>`);
    await expect(el).to.be.accessible();
  });
});
