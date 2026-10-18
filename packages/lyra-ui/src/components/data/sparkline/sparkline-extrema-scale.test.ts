import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html } from '@open-wc/testing';
import './sparkline.js';
import type { LyraSparkline } from './sparkline.js';

it('retains a late extremum and endpoints with bounded million-value projection storage', async () => {
  const values = new Array<number>(1_000_000).fill(0); values[999_998] = 100;
  const el = await fixture<LyraSparkline>(html`<lr-sparkline .values=${values}></lr-sparkline>`);
  const seam = el as unknown as { plotValues(): number[]; points(): readonly (readonly [number, number])[] };
  const points = seam.points();
  expect(points.some(([x, y]) => x > 99 && x < 100 && y === 0)).to.equal(true);
  expect(points[0]).to.deep.equal([0, 100]);
  expect(points.at(-1)).to.deep.equal([100, 100]);
  expect(seam.plotValues().length).to.be.at.most(500);
  expect(points.length).to.be.at.most(500);
  recordScaleMeasurement('lr-sparkline', 'n=1000000 endpoint extrema projection', { retained: seam.plotValues().length, plotted: points.length });
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.include('1,000,000');
  expect(el.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')).to.include(',0');
});

it('retains finite-count positions, both extrema and the final string sample without a full parsed array', async () => {
  const values = new Array<string>(20_000).fill('0'); values[3] = '-100'; values[19_998] = '100'; values[10] = 'invalid';
  const el = await fixture<LyraSparkline>(html`<lr-sparkline .data=${values.join(' ')}></lr-sparkline>`);
  const seam = el as unknown as { plotValues(): number[]; points(): readonly (readonly [number, number])[] };
  expect(seam.plotValues()).to.include(-100).and.include(100);
  expect(seam.plotValues().length).to.be.at.most(500);
  expect(seam.points().at(-1)![0]).to.equal(100);
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.include('19,999');
});
