import { expect, fixture, html } from '@open-wc/testing';
import './graph-legend.js';
import type { LyraGraphLegend } from './graph-legend.js';
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
