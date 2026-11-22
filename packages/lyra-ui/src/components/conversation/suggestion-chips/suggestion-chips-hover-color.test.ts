import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-suggestion-chips.js';
import type { LyraSuggestionChips } from '../../lr-suggestion-chips.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';

it('recolours a hovered chip from --lr-suggestion-chips-hover-color, keeping the chip colour while unset', async () => {
  const el = await fixture<LyraSuggestionChips>(html`<lr-suggestion-chips
    style="--lr-suggestion-chips-chip-color: rgb(1, 2, 3)"
    .suggestions=${[{ suggestionId: 'a', label: 'Summarize this' }]}></lr-suggestion-chips>`);
  const chip = el.shadowRoot!.querySelector<HTMLElement>('[part~="chip"]')!;
  try {
    await hoverUntilMatched(chip, 'pointer did not reach the chip');
    expect(getComputedStyle(chip).color).to.equal('rgb(1, 2, 3)');
    el.style.setProperty('--lr-suggestion-chips-hover-color', 'rgb(40, 50, 60)');
    await waitUntil(() => getComputedStyle(chip).color === 'rgb(40, 50, 60)', 'hover colour token did not apply');
  } finally {
    await resetMouse();
  }
});
