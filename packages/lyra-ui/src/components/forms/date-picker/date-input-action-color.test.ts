import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-date-input.js';

const action = (el: Element, part: string): string =>
  getComputedStyle(el.shadowRoot!.querySelector(`[part="${part}"]`)!).color;

describe('lr-date-input --lr-date-input-action-color', () => {
  it('recolours the resting calendar and clear actions and keeps the quiet default unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="--lr-color-text-quiet: rgb(9, 9, 9)">
      <lr-date-input with-clear value="2026-01-02"></lr-date-input>
      <lr-date-input with-clear value="2026-01-02" style="--lr-date-input-action-color: rgb(1, 2, 3)"></lr-date-input>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-date-input'));
    await (themed as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    expect(action(plain!, 'expand-button')).to.equal('rgb(9, 9, 9)');
    expect([action(themed!, 'expand-button'), action(themed!, 'clear-button')]).to.deep.equal(['rgb(1, 2, 3)', 'rgb(1, 2, 3)']);
  });
});
