import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-locale-picker.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';

setFlagUrlResolver(async () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E');

const listbox = (el: Element): string =>
  getComputedStyle(el.shadowRoot!.querySelector('[part="listbox"]')!).minInlineSize;

describe('lr-locale-picker --lr-locale-picker-listbox-min-inline-size', () => {
  it('sets the popover floor and keeps the 12rem default unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-locale-picker .locales=${['en', 'fr']}></lr-locale-picker>
      <lr-locale-picker .locales=${['en', 'fr']} style="--lr-locale-picker-listbox-min-inline-size: 5rem"></lr-locale-picker>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-locale-picker'));
    await (themed as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    expect([listbox(plain!), listbox(themed!)]).to.deep.equal(['192px', '80px']);
  });
});
