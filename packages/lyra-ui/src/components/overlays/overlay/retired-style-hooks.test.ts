import { expect, fixture, html } from '@open-wc/testing';
import '../callout/callout.js';
import '../empty/empty.js';
import '../../forms/icon-button/icon-button.js';
import '../../forms/button/button.js';
import './dropdown.js';
import type { LyraDropdown } from './dropdown.class.js';

for (const [tagName, selector, retired, canonical] of [
  ['lr-callout', ':host', '--lr-callout-background', '--lr-callout-bg'],
  ['lr-icon-button', '[part~="button"]', '--lr-icon-button-background', '--lr-icon-button-bg'],
] as const) {
  it(`${tagName} paints only the canonical background hook`, async () => {
    const el = await fixture<HTMLElement>(document.createElement(tagName));
    const target = selector === ':host' ? el : el.shadowRoot!.querySelector<HTMLElement>(selector)!;
    target.style.transition = 'none';
    const original = getComputedStyle(target).backgroundColor;
    el.style.setProperty(retired, 'rgb(1, 2, 3)');
    expect(getComputedStyle(target).backgroundColor).to.equal(original);
    el.style.setProperty(canonical, 'rgb(7, 8, 9)');
    expect(getComputedStyle(target).backgroundColor).to.equal('rgb(7, 8, 9)');
  });
}

it('dropdown exposes canonical popup parts without retired double-underscore names', async () => {
  const host = await fixture<HTMLElement>(html`<div>
    <style>
      lr-dropdown::part(popup__popup) { outline: 9px solid red; }
      lr-dropdown::part(popup-popup) { border-top: 7px solid rgb(1, 2, 3); }
    </style>
    <lr-dropdown><button slot="trigger">Open</button><button>Action</button></lr-dropdown>
  </div>`);
  const el = host.querySelector('lr-dropdown') as LyraDropdown;
  const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup-popup"]')!;
  expect(getComputedStyle(popup).outlineWidth).not.to.equal('9px');
  expect(getComputedStyle(popup).borderTopWidth).to.equal('7px');
  expect(el.shadowRoot!.querySelector('[part~="popup__arrow"]') === null).to.equal(true);
});

it('quiet button text ignores the retired-only color token and retains canonical reach', async () => {
  const el = await fixture<HTMLElement>(html`<lr-button appearance="quiet">Save</lr-button>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  base.style.transition = 'none';
  const before = getComputedStyle(base).color;
  el.style.setProperty('--lr-button-quiet-text', 'rgb(1, 2, 3)');
  expect(getComputedStyle(base).color).to.equal(before);
  el.style.setProperty('--lr-button-quiet-color', 'rgb(7, 8, 9)');
  expect(getComputedStyle(base).color).to.equal('rgb(7, 8, 9)');
});

it('empty ignores compact-only markup while canonical small size changes rendered density', async () => {
  const host = await fixture<HTMLElement>(html`<div>
    <lr-empty heading="No results" description="Try another search"></lr-empty>
    <lr-empty compact heading="No results" description="Try another search"></lr-empty>
    <lr-empty size="s" heading="No results" description="Try another search"></lr-empty>
  </div>`);
  const [bare, oldOnly, small] = [...host.querySelectorAll('lr-empty')];
  const paint = (el: Element) => {
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!);
    const heading = getComputedStyle(el.shadowRoot!.querySelector('[part="heading"]')!);
    return [base.paddingTop, base.alignItems, base.textAlign, base.gap, heading.fontWeight];
  };
  expect(oldOnly!.hasAttribute('size')).to.equal(false);
  expect(paint(oldOnly!)).to.deep.equal(paint(bare!));
  expect(paint(small!)).not.to.deep.equal(paint(bare!));
  expect(paint(small!)[1]).to.equal('flex-start');
});
