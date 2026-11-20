import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-export-button.js';
import type { LyraExportButton } from '../../lr-export-button.js';

async function renderMenuButton(): Promise<LyraExportButton> {
  const el = await fixture<LyraExportButton>(html`<lr-export-button></lr-export-button>`);
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  return el;
}

const trigger = (el: LyraExportButton): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;

describe('lr-export-button menu toggling', () => {
  it('closes an open menu when the trigger is activated again', async () => {
    const el = await renderMenuButton();
    trigger(el).click();
    await el.updateComplete;
    expect(el.open).to.equal(true);
    trigger(el).click();
    await el.updateComplete;
    expect(el.open).to.equal(false);
  });

  it('keeps the menu open for a pointerdown inside the component', async () => {
    const el = await renderMenuButton();
    trigger(el).click();
    await el.updateComplete;
    const item = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="menu-item"]')!;
    item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.open).to.equal(true);
  });

  it('refuses to open a menu for a single format', async () => {
    const el = await fixture<LyraExportButton>(html`<lr-export-button></lr-export-button>`);
    el.formats = ['csv'];
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    expect(el.open).to.equal(false);
    expect(el.hasAttribute('open')).to.equal(false);
  });
});
