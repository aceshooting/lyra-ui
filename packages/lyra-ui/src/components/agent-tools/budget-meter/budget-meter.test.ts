import { fixture, expect, html } from '@open-wc/testing';
import './budget-meter.js';
import type { LyraBudgetMeter } from './budget-meter.class.js';

describe('lr-budget-meter', () => {
  it('shows actual formatted values while clamping the visual meter and marking excess', async () => {
    const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter used="125" limit="100" unit="tokens"></lr-budget-meter>`);
    const meter = el.shadowRoot!.querySelector('[part="meter"]')!;
    expect(meter.getAttribute('aria-valuenow')).to.equal('100');
    expect(meter.getAttribute('aria-valuemax')).to.equal('100');
    expect(el.shadowRoot!.querySelector('[part="fill"]')?.getAttribute('aria-valuenow')).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="value"]')?.textContent).to.contain('125');
    expect(el.shadowRoot!.querySelector('[part="value"]')?.textContent).to.contain('100');
    expect(el.shadowRoot!.querySelector('[part="exceeded"]')?.textContent).to.contain('Budget exceeded');
    expect((el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement).style.inlineSize).to.equal('100%');
  });

  it('joins the unit with one space and no trailing space when the unit is empty', async () => {
    const withUnit = await fixture<LyraBudgetMeter>(html`<lr-budget-meter used="5" limit="10" unit="tokens"></lr-budget-meter>`);
    expect(withUnit.shadowRoot!.querySelector('[part="meter"]')?.getAttribute('aria-valuetext')).to.equal('5 of 10 tokens');
    const bare = await fixture<LyraBudgetMeter>(html`<lr-budget-meter used="5" limit="10"></lr-budget-meter>`);
    expect(bare.shadowRoot!.querySelector('[part="value"]')?.textContent).to.equal('5 of 10');
  });

  it('treats a zero or invalid limit as unavailable without a percentage or invalid arithmetic', async () => {
    const zero = await fixture<LyraBudgetMeter>(html`<lr-budget-meter used="12" limit="0"></lr-budget-meter>`);
    expect(Boolean(zero.shadowRoot!.querySelector('[part="meter"]'))).to.be.false;
    expect(zero.shadowRoot!.querySelector('[part="unavailable"]')?.textContent).to.contain('Budget unavailable');
    const invalid = await fixture<LyraBudgetMeter>(html`<lr-budget-meter></lr-budget-meter>`);
    invalid.used = Number.POSITIVE_INFINITY;
    invalid.limit = Number.NaN;
    await invalid.updateComplete;
    expect(Boolean(invalid.shadowRoot!.querySelector('[part="meter"]'))).to.be.false;
    expect(invalid.shadowRoot!.textContent).not.to.contain('NaN');
    expect(invalid.shadowRoot!.textContent).not.to.contain('Infinity');
  });

  it('localizes the semantic name and visible values through strings and the host aria-label', async () => {
    const el = await fixture<LyraBudgetMeter>(html`
      <lr-budget-meter aria-label="Session quota" used="20" limit="50"
        .strings=${{ budgetMeterLabel: 'Run allowance', budgetMeterValue: '{used} / {limit}{unit}' }}></lr-budget-meter>
    `);
    expect(el.shadowRoot!.querySelector('[part="meter"]')?.getAttribute('aria-label')).to.equal('Session quota');
    expect(el.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Run allowance');
    expect(el.shadowRoot!.querySelector('[part="value"]')?.textContent).to.contain('20 / 50');
  });

  it('restores the localized visible label when the label attribute is removed', async () => {
    const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter label="Custom allowance"></lr-budget-meter>`);
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Budget');
  });

  it('is accessible and stays within a narrow RTL allocation with a long unit', async () => {
    const el = await fixture<LyraBudgetMeter>(html`
      <lr-budget-meter dir="rtl" style="inline-size: 320px" used="23" limit="80" .unit=${'وحدة قياس طويلة للغاية '.repeat(8)}></lr-budget-meter>
    `);
    await expect(el).to.be.accessible();
    const host = el.getBoundingClientRect();
    const base = el.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
    const value = el.shadowRoot!.querySelector('[part="value"]')!.getBoundingClientRect();
    expect(el.scrollWidth).to.be.at.most(el.clientWidth);
    expect(base.left).to.be.at.least(host.left - 1);
    expect(base.right).to.be.at.most(host.right + 1);
    expect(value.left).to.be.at.least(host.left - 1);
    expect(value.right).to.be.at.most(host.right + 1);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="value"]')!).direction).to.equal('rtl');
  });
});

describe('lr-budget-meter heading', () => {
  it('follows heading-level, drops heading semantics for none, and renders nothing for an empty label', async () => {
    const heading = (el: LyraBudgetMeter): Element | null => el.shadowRoot!.querySelector('[part="label"]');
    const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter used="1" limit="2" heading-level="4"></lr-budget-meter>`);
    expect([heading(el)!.getAttribute('role'), heading(el)!.getAttribute('aria-level')]).to.deep.equal(['heading', '4']);
    el.headingLevel = 'none';
    await el.updateComplete;
    expect(heading(el)!.getAttribute('role')).to.equal(null);
    el.label = '';
    await el.updateComplete;
    expect(heading(el) === null).to.equal(true);
  });
});
