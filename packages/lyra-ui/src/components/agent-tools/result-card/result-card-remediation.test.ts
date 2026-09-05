import { expect, fixture, html } from '@open-wc/testing';
import './result-card.js';
import './result-field.js';
import type { LyraResultCard } from './result-card.js';
import type { LyraResultField } from './result-field.js';

describe('result components removed labels', () => {
  it('hides a removed heading while preserving actions and later updates', async () => {
    const el = await fixture<LyraResultCard>(html`<lr-result-card heading="Before"><button slot="actions">Action</button>Value</lr-result-card>`);
    el.removeAttribute('heading');
    await el.updateComplete;
    expect(el.heading).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('[part="heading"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="header"]')!.hasAttribute('hidden')).to.equal(false);
    el.setAttribute('heading', '');
    await el.updateComplete;
    expect(el.heading).to.equal('');
    el.setAttribute('heading', 'After');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('After');
  });

  it('removes the field label without losing its value', async () => {
    const el = await fixture<LyraResultField>(html`<lr-result-field label="Before" value="Retained"></lr-result-field>`);
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.label).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('[part="label"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent).to.equal('Retained');
    el.setAttribute('label', '');
    await el.updateComplete;
    expect(el.label).to.equal('');
    el.setAttribute('label', 'After');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.includes('After')).to.equal(true);
  });
});
