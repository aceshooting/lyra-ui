import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-details.js';
import type { LyraDetails } from '../../lr-details.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';

it('recolours the hovered summary from --lr-details-summary-hover-color, keeping the resting colour while unset', async () => {
  const el = await fixture<LyraDetails>(html`<lr-details summary="Shipping" style="--lr-details-summary-color: rgb(1, 2, 3)">Body</lr-details>`);
  const summary = el.shadowRoot!.querySelector<HTMLElement>('[part="summary"]')!;
  try {
    await hoverUntilMatched(summary, 'pointer did not reach the summary');
    expect(getComputedStyle(summary).color).to.equal('rgb(1, 2, 3)');
    el.style.setProperty('--lr-details-summary-hover-color', 'rgb(40, 50, 60)');
    await waitUntil(() => getComputedStyle(summary).color === 'rgb(40, 50, 60)', 'hover colour token did not apply');
  } finally {
    await resetMouse();
  }
  await waitUntil(() => getComputedStyle(summary).color === 'rgb(1, 2, 3)', 'resting colour did not return');
});
