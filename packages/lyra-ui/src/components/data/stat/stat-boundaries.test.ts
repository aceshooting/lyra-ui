import { expect, fixture, html } from '@open-wc/testing';
import './stat.js';
import type { LyraStat } from './stat.js';

it('retains surrounding breakdown rows when one record getter throws', async () => {
  const element = await fixture<LyraStat>(html`<lr-stat></lr-stat>`);
  const invalid = { get label(): string { throw new Error('unavailable label'); }, value: '2' };
  element.rows = [{ label: 'First', value: '1' }, invalid, { label: 'Last', value: '3' }];
  await element.updateComplete;
  expect(element.rows.map(row => row.label)).to.deep.equal(['First', 'Last']);
  expect(Object.isFrozen(element.rows)).to.equal(true);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="row-value"]'), row => row.textContent?.trim()))
    .to.deep.equal(['1', '3']);
});

it('dispatches exactly one native host click when the metric is not linked', async () => {
  const element = await fixture<LyraStat>(html`<lr-stat label="Total" value="3"></lr-stat>`);
  let clicks = 0;
  let targetIsHost = false;
  element.addEventListener('click', event => { clicks += 1; targetIsHost = event.target === element; });
  element.click();
  expect(clicks).to.equal(1);
  expect(targetIsHost).to.equal(true);
  expect(element.shadowRoot!.querySelectorAll('a').length).to.equal(0);
});
