import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-graph-legend.js';
import type { LyraGraphLegend } from '../../lr-graph-legend.js';
import { measureArrayMembership } from '../../../../test/array-membership-cost.js';


it('resolves hidden membership once per legend render and keeps event-time visibility current', async () => {
  const legend = await fixture<LyraGraphLegend>(html`<lr-graph-legend></lr-graph-legend>`);
  const types = Array.from({ length: 96 }, (_, index) => ({ id: `legend-cost-${index}`, label: `Type ${index}` }));
  legend.types = types;
  legend.hiddenTypes = [...types.filter((_type, index) => index % 2 === 0).map((type) => type.id).reverse(), types[0]!.id, ''];
  const measured = measureArrayMembership('legend-cost-', () => legend.render());
  await legend.updateComplete;
  const buttons = [...legend.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="item"]')];
  expect(buttons.map((button) => button.getAttribute('aria-pressed'))).to.deep.equal(types.map((_type, index) => index % 2 === 0 ? 'false' : 'true'));
  expect(measured.comparisons).to.be.at.most(types.length * 2);

  legend.hiddenTypes = [types[1]!.id];
  buttons[0]!.click();
  expect(legend.hiddenTypes).to.deep.equal([types[1]!.id, types[0]!.id]);
});

it('renders at most 200 type rows and discloses the rest in a localized note', async () => {
  const types = Array.from({ length: 230 }, (_, index) => ({ id: `t${index}`, label: `Type ${index}` }));
  const el = await fixture<LyraGraphLegend>(html`<lr-graph-legend .types=${types}></lr-graph-legend>`);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(200);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Showing 200 of 230 graph items.');
  el.types = types.slice(0, 2);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});
