import { expect, fixture, html } from '@open-wc/testing';
import './sparkline.js';
import type { LyraSparkline } from './sparkline.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('reuses the 100000-point projection for an accessible-label change', async () => {
  const el = await fixture<LyraSparkline>(html`<lr-sparkline></lr-sparkline>`);
  let reads = 0;
  const values = Array.from({ length: 100_000 }, (_, index) => index);
  Object.defineProperty(values, '99999', { get() { reads++; return 99999; } });
  el.values = values;
  await el.updateComplete;
  reads = 0;
  el.label = 'Changed'; await el.updateComplete;
  expect(reads).to.equal(0);
  recordScaleMeasurement('lr-sparkline', '100000 points label change', { sourceReads: reads });
});


it('refreshes mutated values on an explicit update', async () => {
  const values = [1, 2, 3];
  const el = await fixture<LyraSparkline>(html`<lr-sparkline .values=${values}></lr-sparkline>`);
  const seam = el as unknown as { plotValues(): number[] };
  values[1] = 99;
  el.requestUpdate(); await el.updateComplete;
  expect(seam.plotValues()).to.deep.equal([1, 99, 3]);
});
