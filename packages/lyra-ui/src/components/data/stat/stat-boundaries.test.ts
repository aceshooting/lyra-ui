import { expect, fixture, html } from '@open-wc/testing';
import './stat.js';
import type { LyraStat } from './stat.js';

it('normalizes incomplete breakdown records without coercing values or discarding later rows', async () => {
  const element = await fixture<LyraStat>(html`<lr-stat label="Totals"></lr-stat>`);
  Reflect.set(element, 'rows', [null, {}, { label: 7, value: false }, { label: 'Total', value: '9', exactValue: 9 }]);
  await element.updateComplete;
  expect(element.rows).to.deep.equal([
    { label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }, { label: 'Total', value: '9' },
  ]);
  expect(element.rows.every(Object.isFrozen)).to.equal(true);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="row-value"]'), row => row.textContent?.trim()))
    .to.deep.equal(['', '', '', '9']);
  element.rows = [{ label: 'Recovered', value: '10', exactValue: '10.00' }];
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="row-label"]')?.textContent?.trim()).to.equal('Recovered');
  expect(element.shadowRoot!.querySelector('[part="row-value"]')?.textContent?.trim()).to.equal('10');
});

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
