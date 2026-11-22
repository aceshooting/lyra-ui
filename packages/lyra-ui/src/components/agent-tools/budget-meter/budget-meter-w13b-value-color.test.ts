import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-budget-meter.js';
import type { LyraBudgetMeter } from './budget-meter.class.js';

const value = (el: LyraBudgetMeter) => getComputedStyle(el.shadowRoot!.querySelector('[part="value"]')!);

describe('lr-budget-meter --lr-budget-meter-value-color', () => {
  it('colours the value readout and keeps the quiet default unset', async () => {
    const plain = await fixture<LyraBudgetMeter>(html`<lr-budget-meter used="5" limit="10"></lr-budget-meter>`);
    const probe = document.createElement('span');
    probe.style.color = 'var(--lr-color-text-quiet)';
    plain.shadowRoot!.append(probe);
    const quiet = getComputedStyle(probe).color;
    probe.remove();
    expect(value(plain).color).to.equal(quiet);
    const el = await fixture<LyraBudgetMeter>(
      html`<lr-budget-meter used="5" limit="10" style="--lr-budget-meter-value-color: rgb(1, 2, 3)"></lr-budget-meter>`,
    );
    expect(value(el).color).to.equal('rgb(1, 2, 3)');
  });
});
