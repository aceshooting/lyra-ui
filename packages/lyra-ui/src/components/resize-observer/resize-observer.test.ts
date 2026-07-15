import { expect, fixture, html } from '@open-wc/testing';
import './resize-observer.js';
import type { LyraResizeObserver } from './resize-observer.class.js';

describe('<lyra-resize-observer>', () => {
  it('observes slotted elements without adding layout', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lyra-resize-observer><button>Resize me</button></lyra-resize-observer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(getComputedStyle(el).display).to.equal('contents');
  });

  it('supports disabling observation', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lyra-resize-observer disabled><button>Resize me</button></lyra-resize-observer>`);
    expect(el.disabled).to.equal(true);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lyra-resize-observer><button>Resize me</button></lyra-resize-observer>`);
    await expect(el).to.be.accessible();
  });
});
