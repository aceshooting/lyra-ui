import { expect, fixture, html } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import './dropdown-item.js';
import './menu-label.js';
import '../../utility/divider/divider.js';
import '../../overlays/overlay/dropdown.js';
import type { LyraMenu } from './menu.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';

it('keeps supported default rows while placing arbitrary controls outside the menu role', async () => {
  const el = await fixture<LyraMenu>(html`<lr-menu>
    <input slot="header" aria-label="Filter items" value="query">
    <lr-menu-label>Group</lr-menu-label>
    <lr-menu-item>First</lr-menu-item><hr>
    <lr-dropdown-item>Second</lr-dropdown-item><lr-divider></lr-divider>
    <button slot="footer">Apply</button>
  </lr-menu>`);
  const listSlot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot:not([name])')!;
  expect(listSlot.assignedElements().map((node) => node.localName)).to.deep.equal([
    'lr-menu-label', 'lr-menu-item', 'hr', 'lr-dropdown-item', 'lr-divider',
  ]);
  for (const slotName of ['header', 'footer']) {
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${slotName}"]`)!;
    expect(slot.closest('[role="menu"]') === null).to.equal(true);
    expect(slot.assignedElements().length).to.equal(1);
    expect(getComputedStyle(slot.assignedElements()[0]!).display).not.to.equal('none');
  }
});

it('keeps dropdown free-form content in its independent default-slot contract', async () => {
  const el = await fixture<LyraDropdown>(html`<lr-dropdown open>
    <button slot="trigger">Open actions</button>
    <button id="freeform">Custom action</button>
  </lr-dropdown>`);
  const action = el.querySelector<HTMLButtonElement>('#freeform')!;
  let activations = 0;
  action.addEventListener('click', () => activations++);
  action.click();
  expect(activations).to.equal(1);
  expect(action.assignedSlot !== null).to.equal(true);
  expect(getComputedStyle(action).display).not.to.equal('none');
});
