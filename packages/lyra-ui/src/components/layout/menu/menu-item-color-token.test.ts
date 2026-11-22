import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-menu-item.js';
import '../../lr-dropdown-item.js';
import '../../lr-menu-label.js';
import type { LyraMenuItem } from '../../lr-menu-item.js';

const base = (el: LyraMenuItem) => getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!);

it('paints a resting row from --lr-menu-item-color, inheriting the host colour while unset, and checked keeps its own token', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-menu-item>Plain</lr-menu-item>
    <lr-menu-item style="--lr-menu-item-color: rgb(10, 20, 30)">Tinted</lr-menu-item>
    <lr-menu-item type="checkbox" checked style="--lr-menu-item-color: rgb(10, 20, 30); --lr-menu-item-checked-color: rgb(40, 50, 60)">Checked</lr-menu-item>
    <lr-menu-item type="checkbox" checked style="--lr-menu-item-color: rgb(10, 20, 30)">Checked default</lr-menu-item>
  </div>`);
  const items = [...wrapper.querySelectorAll<LyraMenuItem>('lr-menu-item')];
  await Promise.all(items.map((item) => item.updateComplete));
  expect(JSON.stringify(items.map((item) => base(item).color))).to.equal(JSON.stringify([
    getComputedStyle(items[0]!).color, 'rgb(10, 20, 30)', 'rgb(40, 50, 60)', 'rgb(10, 20, 30)',
  ]));
});

it('sets the row weight, letter spacing and details hint from tokens, keeping defaults unset', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-dropdown-item>Plain<span slot="details">Hint</span></lr-dropdown-item>
    <lr-dropdown-item style="--lr-menu-item-font-weight: 600; --lr-menu-item-letter-spacing: 1px; --lr-menu-item-details-font-size: 9px; --lr-menu-item-details-color: rgb(1, 2, 3)">Tuned<span slot="details">Hint</span></lr-dropdown-item>
  </div>`);
  const [plain, tuned] = [...wrapper.querySelectorAll<LyraMenuItem>('lr-dropdown-item')];
  await Promise.all([plain!.updateComplete, tuned!.updateComplete]);
  const read = (el: LyraMenuItem) => {
    const details = getComputedStyle(el.shadowRoot!.querySelector('[part="details"]')!);
    return [base(el).fontWeight, base(el).letterSpacing, details.fontSize, details.color];
  };
  const defaults = read(plain!);
  expect(defaults[0]).to.equal(getComputedStyle(plain!).fontWeight);
  expect(defaults[1]).to.equal('normal');
  expect(read(tuned!)).to.deep.equal(['600', '1px', '9px', 'rgb(1, 2, 3)']);
});

it('sets the menu label weight and letter spacing from tokens', async () => {
  const label = await fixture<HTMLElement>(html`<lr-menu-label style="--lr-menu-label-font-weight: 300; --lr-menu-label-letter-spacing: 2px">Group</lr-menu-label>`);
  await (label as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const part = getComputedStyle(label.shadowRoot!.querySelector('[part="base"]')!);
  expect([part.fontWeight, part.letterSpacing]).to.deep.equal(['300', '2px']);
  label.style.cssText = '';
  expect(getComputedStyle(label.shadowRoot!.querySelector('[part="base"]')!).letterSpacing).to.equal('normal');
});
