import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-confirm-bar.js';

it('registers argument viewers when a connected bar first receives arguments', async () => {
  const bar = await fixture<HTMLElementTagNameMap['lr-confirm-bar']>(html`<lr-confirm-bar></lr-confirm-bar>`);
  expect(customElements.get('lr-json-viewer') === undefined).to.equal(true);
  expect(customElements.get('lr-details') === undefined).to.equal(true);
  bar.args = {name: 'test'};
  await bar.updateComplete;
  await Promise.all([customElements.whenDefined('lr-details'), customElements.whenDefined('lr-json-viewer')]);
  expect(bar.shadowRoot!.querySelector('lr-json-viewer')!.data).to.deep.equal({name:'test'});
});
