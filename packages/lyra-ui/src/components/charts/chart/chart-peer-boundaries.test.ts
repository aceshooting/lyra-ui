import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import type { LyraChart } from './chart.js';

it('normalizes a non-array raw plugin value before handing configuration to the peer', async () => {
  const element = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table
    .labels=${['First']} .datasets=${[{ label: 'Visits', data: [7] }]}
    .config=${{ plugins: { invalid: true } }}></lr-chart>`);
  await waitUntil(() => element.shadowRoot!.querySelector('table')?.textContent?.includes('7') === true);
  const config = (element as unknown as { buildConfig(): { plugins: unknown } }).buildConfig();
  expect(config.plugins).to.deep.equal([]);
  expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Visits');
});

it('falls back to the default legend placement when reflective placement data throws', async () => {
  const placement = new Proxy({}, { ownKeys() { throw new Error('placement unavailable'); } });
  const element = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table
    .legendPosition=${placement} .labels=${['First']}
    .datasets=${[{ label: 'Visits', data: [7] }]}></lr-chart>`);
  await waitUntil(() => element.shadowRoot!.querySelector('table')?.textContent?.includes('7') === true);
  const config = (element as unknown as {
    buildConfig(): { options: { plugins: { legend: { position: unknown } } } };
  }).buildConfig();
  expect(config.options.plugins.legend.position).to.equal('top');
  expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Visits');
});
