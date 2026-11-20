import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-input.js';
import '../../lr-number-input.js';
import type { LyraInput } from './input.class.js';
import type { LyraNumberInput } from './number-input.class.js';

type Valued = HTMLElement & { value: string; updateComplete: Promise<unknown> };

/** Records every library value event, and rewrites `value` from the first native `input`. */
function trackWithRewrite(el: Valued, rewrite: string): string[] {
  const seen: string[] = [];
  el.addEventListener('input', () => { el.value = rewrite; }, { once: true });
  el.addEventListener('lr-input', (event) => seen.push(`lr-input ${(event as CustomEvent<{ value: string }>).detail.value}`));
  el.addEventListener('lr-change', (event) => seen.push(`lr-change ${(event as CustomEvent<{ value: string }>).detail.value}`));
  return seen;
}

describe('value events report the committed value, not a listener rewrite', () => {
  it('lr-input clear reports the cleared value on both events', async () => {
    const el = await fixture<LyraInput>(html`<lr-input label="Name" with-clear value="abc"></lr-input>`);
    const seen = trackWithRewrite(el, 'rewritten');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]')!.click();
    await el.updateComplete;
    expect(seen).to.deep.equal(['lr-input ', 'lr-change ']);
  });

  it('lr-number-input stepper reports the stepped value on both events', async () => {
    const el = await fixture<LyraNumberInput>(html`<lr-number-input label="Count" value="1"></lr-number-input>`);
    const seen = trackWithRewrite(el, '99');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="stepper-up"]')!.click();
    await el.updateComplete;
    expect(seen).to.deep.equal(['lr-input 2', 'lr-change 2']);
  });
});
