import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './icon-button.js';

it('forwards its accessible label and click event', async () => {
  const el = await fixture(html`<lyra-icon-button icon="close" aria-label="Dismiss"></lyra-icon-button>`);
  expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Dismiss');
  const event = oneEvent(el, 'click');
  el.shadowRoot!.querySelector('button')!.click();
  expect((await event).bubbles).to.be.true;
});
