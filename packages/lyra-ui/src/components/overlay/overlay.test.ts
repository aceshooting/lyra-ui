import { fixture, expect, html } from '@open-wc/testing';
import './popover.js';
import './tooltip.js';
import './dropdown.js';

it('opens a popover from its slotted trigger and wires dialog semantics', async () => {
  const el = await fixture(html`
    <lyra-popover><button slot="trigger">Open</button><p>Details</p></lyra-popover>
  `);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect((el as HTMLElement).hasAttribute('open')).to.be.true;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('dialog');
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');
  expect(popup.getAttribute('role')).to.equal('dialog');
  await expect(el).to.be.accessible();
});

it('uses menu semantics for dropdowns', async () => {
  const el = await fixture(html`<lyra-dropdown><button slot="trigger">Actions</button><div>Item</div></lyra-dropdown>`);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
  trigger.click();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.shadowRoot!.querySelector('[part="popup"]')?.getAttribute('role')).to.equal('menu');
});

it('shows a tooltip after focus and describes the trigger', async () => {
  const el = await fixture(html`<lyra-tooltip delay="0">Helpful text<button slot="trigger">Help</button></lyra-tooltip>`);
  const trigger = el.querySelector('button') as HTMLButtonElement;
  trigger.focus();
  await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  expect(el.hasAttribute('open')).to.be.true;
  expect(trigger.hasAttribute('aria-describedby')).to.be.true;
  await expect(el).to.be.accessible();
});
