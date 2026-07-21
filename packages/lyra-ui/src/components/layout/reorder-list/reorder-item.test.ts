import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './reorder-item.js';
import type { LyraReorderItem } from './reorder-item.class.js';

describe('<lr-reorder-item>', () => {
  it('renders slotted content with role="listitem"', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row A</lr-reorder-item>`);
    expect(el.getAttribute('role')).to.equal('listitem');
    expect(el.textContent?.trim()).to.equal('Row A');
  });

  it('defaults to value=undefined, disabled=false, atStart=false, atEnd=false, listDisabled=false', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row</lr-reorder-item>`);
    expect(el.value).to.be.undefined;
    expect(el.disabled).to.be.false;
    expect(el.atStart).to.be.false;
    expect(el.atEnd).to.be.false;
    expect(el.listDisabled).to.be.false;
  });

  it('renders localized move-up/move-down button aria-labels, overridable via .strings', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row</lr-reorder-item>`);
    let up = el.shadowRoot!.querySelector('[part="move-up-button"]')!;
    let down = el.shadowRoot!.querySelector('[part="move-down-button"]')!;
    expect(up.getAttribute('aria-label')).to.equal('Move up');
    expect(down.getAttribute('aria-label')).to.equal('Move down');

    el.strings = { moveUp: 'Déplacer vers le haut', moveDown: 'Déplacer vers le bas' };
    await el.updateComplete;
    up = el.shadowRoot!.querySelector('[part="move-up-button"]')!;
    down = el.shadowRoot!.querySelector('[part="move-down-button"]')!;
    expect(up.getAttribute('aria-label')).to.equal('Déplacer vers le haut');
    expect(down.getAttribute('aria-label')).to.equal('Déplacer vers le bas');
  });

  it('emits lr-move-request with the correct direction on click', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row</lr-reorder-item>`);
    const up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    const down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;

    let listener = oneEvent(el, 'lr-move-request');
    up.click();
    let event = (await listener) as CustomEvent<{ direction: string }>;
    expect(event.detail.direction).to.equal('up');

    listener = oneEvent(el, 'lr-move-request');
    down.click();
    event = (await listener) as CustomEvent<{ direction: string }>;
    expect(event.detail.direction).to.equal('down');
  });

  it('disables both buttons and never emits lr-move-request when disabled', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item disabled>Row</lr-reorder-item>`);
    const up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    const down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    expect(up.disabled).to.be.true;
    expect(down.disabled).to.be.true;

    let emitted = false;
    el.addEventListener('lr-move-request', () => {
      emitted = true;
    });
    up.click();
    down.click();
    expect(emitted).to.be.false;
  });

  it('disables the move-up button at atStart, the move-down button at atEnd, and both when listDisabled', async () => {
    const el = await fixture<LyraReorderItem>(html`<lr-reorder-item>Row</lr-reorder-item>`);
    el.atStart = true;
    await el.updateComplete;
    let up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    let down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    expect(up.disabled).to.be.true;
    expect(down.disabled).to.be.false;

    el.atStart = false;
    el.atEnd = true;
    await el.updateComplete;
    up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    expect(up.disabled).to.be.false;
    expect(down.disabled).to.be.true;

    el.atEnd = false;
    el.listDisabled = true;
    await el.updateComplete;
    up = el.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    down = el.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement;
    expect(up.disabled).to.be.true;
    expect(down.disabled).to.be.true;
  });

  // A `role="listitem"` host is only ARIA-valid nested inside a `role="list"` ancestor (the
  // WAI-ARIA required-parent rule) -- <lr-reorder-item> is never used standalone in practice (it's
  // always a child of <lr-reorder-list>, which renders role="list"), so this wraps it the same way
  // <lr-tree-node>'s own accessibility test wraps in role="tree", while still asserting
  // accessibility on the item's own instance.
  it('is accessible, including when disabled', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div role="list"><lr-reorder-item>Row</lr-reorder-item></div>`,
    );
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    await expect(el).to.be.accessible();

    const disabledWrapper = await fixture<HTMLDivElement>(
      html`<div role="list"><lr-reorder-item disabled>Row</lr-reorder-item></div>`,
    );
    const disabledEl = disabledWrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    await expect(disabledEl).to.be.accessible();
  });

  it('renders correctly under dir="rtl"', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl" role="list"><lr-reorder-item>Row</lr-reorder-item></div>`,
    );
    const el = wrapper.querySelector('lr-reorder-item') as LyraReorderItem;
    await expect(el).to.be.accessible();
  });
});
