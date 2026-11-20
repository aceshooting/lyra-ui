import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-confirm-bar.js';

it('upgrades argument viewers on reconnect after the arguments arrived while detached', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><lr-confirm-bar></lr-confirm-bar></div>`);
  const bar = wrapper.querySelector('lr-confirm-bar')!;
  bar.remove();
  bar.args = { city: 'Oslo' };
  await bar.updateComplete;
  expect(customElements.get('lr-json-viewer') === undefined).to.equal(true);
  wrapper.append(bar);
  await bar.updateComplete;
  const details = bar.shadowRoot!.querySelector('lr-details')!;
  const viewer = bar.shadowRoot!.querySelector('lr-json-viewer')!;
  expect(details.matches(':defined')).to.equal(true);
  expect(viewer.matches(':defined')).to.equal(true);
  expect(viewer.data).to.deep.equal({ city: 'Oslo' });
});
