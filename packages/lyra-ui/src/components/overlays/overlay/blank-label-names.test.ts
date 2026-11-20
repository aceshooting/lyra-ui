// A whitespace-only label never becomes an empty popup or menu name.
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-popover.js';
import '../../lr-dropdown.js';
import '../../lr-context-menu.js';

const popupName = (host: Element): string | null => {
  const root = host.shadowRoot!.querySelector('lr-menu')?.shadowRoot ?? host.shadowRoot!;
  return root.querySelector('[role="menu"], [role="dialog"]')?.getAttribute('aria-label') ?? null;
};

describe('blank popup and menu labels', () => {
  it('popover and dropdown fall back to the localized default', async () => {
    const popover = await fixture<Element>(
      html`<lr-popover aria-label="   " popup-role="dialog"><button slot="trigger">x</button></lr-popover>`,
    );
    expect(popupName(popover)).to.equal('Popover');
    const dropdown = await fixture<Element>(
      html`<lr-dropdown aria-label="   "><button slot="trigger">x</button></lr-dropdown>`,
    );
    expect(popupName(dropdown)).to.equal('Menu');
  });

  it('context-menu falls back to the localized default', async () => {
    const menu = await fixture<Element>(html`<lr-context-menu label="   "></lr-context-menu>`);
    const inner = menu.shadowRoot!.querySelector('lr-dropdown')!;
    await (inner as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(popupName(inner)).to.equal('Menu');
  });
});
