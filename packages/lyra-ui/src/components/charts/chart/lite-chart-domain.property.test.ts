import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import './lite-chart.js';

it('preserves the order of distinct finite values across narrow and wide scientific domains', async () => {
  const element = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line" without-zero-baseline
    style="inline-size:500px;block-size:240px" .labels=${['First', 'Middle', 'Last']}
    .datasets=${[{ label: 'Values', data: [1, 2, 3] }]}></lr-lite-chart>`);
  const positions = () => [...element.shadowRoot!.querySelectorAll('[part="point"]')]
    .map(point => Number(point.getAttribute('cy')));
  await waitUntil(() => {
    const ys = positions();
    return ys.length === 3 && ys[0]! > ys[2]!;
  }, 'the initial chart must have a measured plot');

  await fc.assert(fc.asyncProperty(
    fc.integer({ min: -280, max: 280 }),
    fc.constantFrom(Number.EPSILON, 4 * Number.EPSILON, 1e-10, 0.01, 1, 10),
    fc.constantFrom('linear', 'logarithmic'),
    fc.boolean(),
    async (exponent, increment, scale, negative) => {
      const base = 10 ** exponent;
      const values = [base, base * (1 + increment), base * (1 + 2 * increment)];
      if (scale === 'linear' && negative) values.reverse().forEach((value, index) => { values[index] = -value; });
      expect(values[0]).to.be.lessThan(values[1]!);
      expect(values[1]).to.be.lessThan(values[2]!);
      element.scale = scale;
      element.datasets = [{ label: 'Values', data: values }];
      await element.updateComplete;
      const ys = positions();
      expect(ys.length).to.equal(3);
      expect(ys.every(Number.isFinite)).to.equal(true);
      expect(ys[0]).to.be.greaterThan(ys[1]!);
      expect(ys[1]).to.be.greaterThan(ys[2]!);
    },
  ), propertyRuns());
});
