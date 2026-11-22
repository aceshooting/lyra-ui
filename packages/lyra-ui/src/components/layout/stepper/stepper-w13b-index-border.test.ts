import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-stepper.js';
import type { LyraStepper } from '../../lr-stepper.js';

const steps = [
  { stepId: 'a', label: 'A', state: 'pending' as const },
  { stepId: 'b', label: 'B', state: 'current' as const },
  { stepId: 'c', label: 'C', state: 'error' as const },
];
const index = (el: LyraStepper, state: string) =>
  getComputedStyle(el.shadowRoot!.querySelector(`[part="step"][data-state="${state}"] [part="step-index"]`)!);

describe('lr-stepper index border tokens', () => {
  it('draws no border unset', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${steps}></lr-stepper>`);
    expect(index(el, 'pending').borderTopWidth).to.equal('0px');
  });

  it('applies --lr-stepper-index-border, with current and error overrides', async () => {
    const el = await fixture<LyraStepper>(html`<lr-stepper .steps=${steps}
      style="--lr-stepper-index-border: 2px solid rgb(1, 2, 3); --lr-stepper-current-index-border: 3px solid rgb(4, 5, 6)"></lr-stepper>`);
    expect([index(el, 'pending').borderTopWidth, index(el, 'pending').borderTopColor]).to.deep.equal(['2px', 'rgb(1, 2, 3)']);
    expect([index(el, 'current').borderTopWidth, index(el, 'current').borderTopColor]).to.deep.equal(['3px', 'rgb(4, 5, 6)']);
    expect(index(el, 'error').borderTopColor).to.equal('rgb(1, 2, 3)');
    expect(index(el, 'pending').width).to.equal(index(el, 'current').width);
  });
});
