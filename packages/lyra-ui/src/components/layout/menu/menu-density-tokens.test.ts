import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-menu.js';
import '../../lr-menu-item.js';
import '../../lr-menu-label.js';
import '../../lr-dropdown.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';
import { resolvedInShadow } from '../../../../test/shadow-style.js';

const DENSE = [
  '--lr-transition-fast: 0ms',
  '--lr-menu-padding: 7px',
  '--lr-menu-gap: 5px',
  '--lr-menu-item-padding-block: 3px',
  '--lr-menu-item-padding-inline: 9px',
  '--lr-menu-item-font-size: 11px',
  '--lr-menu-item-icon-size: 13px',
  '--lr-menu-label-padding: 1px 6px',
  '--lr-menu-label-font-size: 10px',
].join('; ');

async function openMenu(style: string): Promise<{
  menu: HTMLElement;
  item: HTMLElement;
  list: CSSStyleDeclaration;
  base: CSSStyleDeclaration;
  icon: CSSStyleDeclaration;
  label: CSSStyleDeclaration;
}> {
  const dropdown = await fixture<LyraDropdown>(html`<lr-dropdown style=${style}>
    <button slot="trigger">Open</button>
    <lr-menu label="Account">
      <lr-menu-label>Signed in</lr-menu-label>
      <lr-menu-item value="profile"><span slot="icon">P</span>Profile</lr-menu-item>
      <lr-menu-item value="logout">Sign out</lr-menu-item>
    </lr-menu>
  </lr-dropdown>`);
  await dropdown.show();
  const menu = dropdown.querySelector('lr-menu')!;
  const item = dropdown.querySelector('lr-menu-item')!;
  const heading = dropdown.querySelector('lr-menu-label')!;
  await item.updateComplete;
  return {
    menu,
    item,
    list: getComputedStyle(menu.shadowRoot!.querySelector('[part="list"]')!),
    base: getComputedStyle(item.shadowRoot!.querySelector('[part="base"]')!),
    icon: getComputedStyle(item.shadowRoot!.querySelector('[part~="icon"]')!),
    label: getComputedStyle(heading.shadowRoot!.querySelector('[part="base"]')!),
  };
}

describe('menu density tokens', () => {
  it('reach the list, row, icon and heading inside an open dropdown', async () => {
    const { list, base, icon, label } = await openMenu(DENSE);
    expect(list.paddingBlockStart).to.equal('7px');
    expect(list.rowGap).to.equal('5px');
    expect(base.paddingBlockStart).to.equal('3px');
    expect(base.paddingInlineStart).to.equal('9px');
    expect(base.fontSize).to.equal('11px');
    expect(icon.fontSize).to.equal('13px');
    expect(label.paddingInlineStart).to.equal('6px');
    expect(label.fontSize).to.equal('10px');
  });

  it('keeps the previous spacing when unset', async () => {
    const { menu, item, list, base, icon } = await openMenu('--lr-transition-fast: 0ms');
    expect(list.paddingBlockStart).to.equal(resolvedInShadow(menu, 'padding: var(--lr-space-xs)', 'padding-block-start'));
    expect(list.rowGap).to.be.oneOf(['0px', 'normal']);
    expect(base.paddingInlineStart).to.equal(
      resolvedInShadow(item, 'padding-inline: var(--lr-form-control-padding-inline)', 'padding-inline-start'),
    );
    expect(base.fontSize).to.equal(resolvedInShadow(item, 'font-size: var(--lr-form-control-font-size)', 'font-size'));
    expect(icon.fontSize).to.equal(base.fontSize);
  });
});
