import { expect, fixture, html } from '@open-wc/testing';
import './gauge.js';
import type { LyraGauge, LyraGaugeThreshold } from './gauge.js';

it('selects the greatest eligible threshold with linear reads of unsorted boundaries', async () => {
  const gauge = await fixture<LyraGauge>(html`<lr-gauge value="1000" max="1000" label="Score"></lr-gauge>`);
  const boundaries = Array.from({ length: 128 }, (_, index) => (index * 73) % 128);
  let reads = 0;
  const thresholds: LyraGaugeThreshold[] = boundaries.map((at) => ({
    get at() { reads++; return at; },
    variant: at === 127 ? 'danger' : 'success',
  }));
  gauge.thresholds = thresholds;
  await gauge.updateComplete;

  expect(gauge.getAttribute('data-effective-variant')).to.equal('danger');
  expect(reads).to.be.at.most(thresholds.length * 3);
  expect(thresholds.map((threshold) => threshold.at)).to.deep.equal(boundaries);
});

it('keeps the last equal boundary, ignores nonfinite thresholds, and reads live caller edits', async () => {
  const gauge = await fixture<LyraGauge>(html`<lr-gauge value="50" variant="brand" label="Score"></lr-gauge>`);
  const thresholds: { at: number; variant: LyraGaugeThreshold['variant'] }[] = [
    { at: 50, variant: 'danger' },
    { at: Number.NaN, variant: 'danger' },
    { at: 10, variant: 'neutral' },
    { at: 50, variant: 'success' },
    { at: Number.POSITIVE_INFINITY, variant: 'danger' },
    { at: Number.NEGATIVE_INFINITY, variant: 'danger' },
  ];
  gauge.thresholds = thresholds;
  await gauge.updateComplete;
  expect(gauge.getAttribute('data-effective-variant')).to.equal('success');

  thresholds[3]!.at = 60;
  gauge.requestUpdate();
  await gauge.updateComplete;
  expect(gauge.getAttribute('data-effective-variant')).to.equal('danger');
  expect(thresholds.map((threshold) => threshold.at)).to.deep.equal([50, Number.NaN, 10, 60, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]);

  const sparse: LyraGaugeThreshold[] = new Array(3);
  sparse[1] = { at: 0, variant: 'warning' };
  sparse[2] = { at: '25' as unknown as number, variant: 'danger' };
  gauge.thresholds = sparse;
  await gauge.updateComplete;
  expect(gauge.getAttribute('data-effective-variant')).to.equal('warning');

  gauge.value = Number.NaN;
  await gauge.updateComplete;
  expect(gauge.getAttribute('data-effective-variant')).to.equal('brand');
});
