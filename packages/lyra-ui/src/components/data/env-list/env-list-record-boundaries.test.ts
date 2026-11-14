import { expect, fixture, html } from '@open-wc/testing';
import type { LyraEnvList } from './env-list.js';
import './env-list.js';

it('omits incomplete environment records without reserving their names or rendering their values', async () => {
  const element = await fixture<LyraEnvList>(html`<lr-env-list></lr-env-list>`);
  Reflect.set(element, 'entries', [null, {}, { name: 7, value: 'Invalid name' },
    { name: 'MODE', value: false }, { name: 'MODE', value: 'production', secret: false }]);
  await element.updateComplete;
  expect(element.entries).to.deep.equal([{ name: 'MODE', value: 'production', secret: false }]);
  expect(Object.isFrozen(element.entries)).to.equal(true);
  expect(Object.isFrozen(element.entries[0])).to.equal(true);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="name"]'), row => row.textContent?.trim()))
    .to.deep.equal(['MODE']);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="value"]'), row => row.textContent?.trim()))
    .to.deep.equal(['production']);
  expect(element.shadowRoot!.querySelectorAll('[part="reveal-button"]').length).to.equal(0);
  element.entries = [{ name: 'MODE', value: 'development', secret: false }];
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="value"]')?.textContent?.trim()).to.equal('development');
});
