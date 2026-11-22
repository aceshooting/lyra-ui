import { expect, fixture, waitUntil } from '@open-wc/testing';
import '../../lr-menu.js';
import '../../lr-menu-item.js';
import '../../lr-dropdown.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';

const NO_MOTION = '--lr-transition-fast: 0ms; --show-duration: 0ms; --hide-duration: 0ms';
const ROWS = Array.from({ length: 40 }, (_, index) => `<lr-menu-item value="r${index}">Row ${index + 1}</lr-menu-item>`).join('');

const listOf = (menu: Element): HTMLElement => menu.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!;

async function openDropdown(style: string, rows = ROWS): Promise<{ dropdown: LyraDropdown; menu: HTMLElement; popup: HTMLElement }> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="padding: 20px"><lr-dropdown style="${NO_MOTION}; ${style}"><button slot="trigger">Open</button><lr-menu label="Rows">${rows}</lr-menu></lr-dropdown></div>`,
  );
  const dropdown = wrapper.querySelector<LyraDropdown>('lr-dropdown')!;
  await dropdown.updateComplete;
  await dropdown.show();
  const popup = dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  await waitUntil(() => popup.style.left !== '' && popup.getBoundingClientRect().height > 0, 'the menu is placed');
  return { dropdown, menu: dropdown.querySelector('lr-menu')!, popup };
}

describe('lr-menu max block size', () => {
  it('caps a contained list with --lr-menu-max-block-size, 20rem while unset', async () => {
    const plain = await openDropdown('');
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const unset = listOf(plain.menu).getBoundingClientRect().height;
    await plain.dropdown.hide({ focusTrigger: false });
    const capped = await openDropdown('--lr-menu-max-block-size: 120px');
    const height = listOf(capped.menu).getBoundingClientRect().height;
    await capped.dropdown.hide({ focusTrigger: false });
    expect(Math.round(unset)).to.equal(Math.min(Math.round(20 * rem), Math.round(window.innerHeight)));
    expect(Math.round(height)).to.equal(120);
  });

  it('raises a standalone list above 20rem with --lr-menu-max-block-size', async () => {
    const menu = await fixture<HTMLElement>(`<lr-menu label="Rows" style="--lr-menu-max-block-size: 30rem">${ROWS}</lr-menu>`);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(Math.round(listOf(menu).getBoundingClientRect().height)).to.equal(Math.round(30 * rem));
    menu.style.removeProperty('--lr-menu-max-block-size');
    expect(Math.round(listOf(menu).getBoundingClientRect().height)).to.equal(Math.round(20 * rem));
  });
});

describe('--lr-overlay-min-inline-size with a consumer lr-menu', () => {
  it('floors the dropdown popup and the display:contents menu list fills it', async () => {
    const short = '<lr-menu-item value="a">A</lr-menu-item>';
    const natural = await openDropdown('', short);
    const naturalWidth = natural.popup.getBoundingClientRect().width;
    await natural.dropdown.hide({ focusTrigger: false });
    const floored = await openDropdown('--lr-overlay-min-inline-size: 300px', short);
    const popupWidth = floored.popup.getBoundingClientRect().width;
    const listWidth = listOf(floored.menu).getBoundingClientRect().width;
    const content = floored.dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="content"]')!;
    const contentStyle = getComputedStyle(content);
    const contentInner = content.clientWidth - parseFloat(contentStyle.paddingInlineStart) - parseFloat(contentStyle.paddingInlineEnd);
    const menuDisplay = getComputedStyle(floored.menu).display;
    await floored.dropdown.hide({ focusTrigger: false });
    expect(menuDisplay).to.equal('contents');
    expect(naturalWidth).to.be.lessThan(300);
    expect(Math.round(popupWidth)).to.equal(300);
    // The menu host is display: contents, so its list is laid out directly in the popup's content
    // column and spans the floored width, less the content padding.
    expect(Math.round(listWidth)).to.equal(Math.round(contentInner));
    expect(contentInner).to.be.greaterThan(280);
  });
});
