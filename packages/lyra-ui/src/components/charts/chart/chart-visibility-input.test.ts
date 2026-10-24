import { expect, fixture, html } from '@open-wc/testing';
import './chart.js';
import type { LyraChart } from './chart.class.js';

describe('lr-chart controlled category visibility input', () => {
  it('keeps only integer category indexes and clears the list for a value that is not a list', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.hiddenDatums = [2, 0, 1.5, Number.NaN, 'one'] as unknown as readonly number[];
    expect(el.hiddenDatums.every((index) => Number.isInteger(index))).to.equal(true);
    expect([...el.hiddenDatums]).to.include.members([0, 2]);
    for (const value of [undefined, null, 'nope', 7, { 0: 1, length: 1 }]) {
      el.hiddenDatums = [1];
      expect(el.hiddenDatums, 'primed').to.deep.equal([1]);
      el.hiddenDatums = value as unknown as readonly number[];
      expect(el.hiddenDatums, String(value)).to.deep.equal([]);
    }
  });

  it('is frozen so a listener cannot mutate the controlled state', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.hiddenDatums = [1];
    expect(Object.isFrozen(el.hiddenDatums)).to.equal(true);
  });
});

describe('lr-chart legend display attribute', () => {
  it('reads a known mode and falls back to automatic when the attribute is removed or unknown', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart legend-display="value-percentage"></lr-chart>`);
    expect(el.legendDisplay).to.equal('value-percentage');
    el.setAttribute('legend-display', 'percentage');
    expect(el.legendDisplay).to.equal('percentage');
    el.removeAttribute('legend-display');
    expect(el.legendDisplay).to.equal('auto');
    el.setAttribute('legend-display', 'bogus');
    expect(el.legendDisplay).to.equal('auto');
  });
});
