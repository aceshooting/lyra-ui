import { expect, fixture, html } from '@open-wc/testing';
import './commit-card.js';
import type { LyraCommitCard } from './commit-card.js';

describe('lr-commit-card removed message', () => {
  it('clears both message sections, preserves null readback, and accepts later text', async () => {
    const el = await fixture<LyraCommitCard>(html`<lr-commit-card message="Subject&#10;Body"></lr-commit-card>`);
    expect(el.message).to.equal('Subject\nBody');
    el.removeAttribute('message');
    await el.updateComplete;
    expect(el.message).to.equal(null);
    expect(el.shadowRoot!.textContent!.includes('Subject')).to.equal(false);
    expect(el.shadowRoot!.textContent!.includes('Body')).to.equal(false);
    el.setAttribute('message', '');
    await el.updateComplete;
    expect(el.message).to.equal('');
    el.setAttribute('message', 'Restored\nDetails');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent!.includes('Restored')).to.equal(true);
    expect(el.shadowRoot!.textContent!.includes('Details')).to.equal(true);
  });
});
