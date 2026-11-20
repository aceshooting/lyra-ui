import { expect, fixture, html } from '@open-wc/testing';
import './attachment-trigger.js';
import type { LyraAttachmentTrigger } from './attachment-trigger.class.js';

it('registers the capability menu only when a trigger first offers several capabilities', async () => {
  const trigger = await fixture<LyraAttachmentTrigger>(html`<lr-attachment-trigger></lr-attachment-trigger>`);
  expect(['lr-dropdown', 'lr-menu-item'].map(name => Boolean(customElements.get(name)))).to.deep.equal([false, false]);
  trigger.capabilities = ['files', 'camera'];
  await trigger.updateComplete;
  const menu = trigger.shadowRoot!.querySelector('lr-dropdown');
  const item = trigger.shadowRoot!.querySelector('lr-menu-item');
  const [Dropdown, MenuItem] = [customElements.get('lr-dropdown'), customElements.get('lr-menu-item')];
  expect([Boolean(Dropdown && menu instanceof Dropdown), Boolean(MenuItem && item instanceof MenuItem)]).to.deep.equal([true, true]);
});
