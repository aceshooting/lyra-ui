import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

it('contains a canvas encoding failure while preserving CSV and later PNG exports', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="width: 400px" .data=${{
    kind: 'matrix', rowLabels: ['Row'], colLabels: ['Column'], values: [[7]],
  }}></lr-heatmap>`);
  await waitUntil(() => element.exportData('png').startsWith('data:image/png'), 'matrix was not painted');
  const csv = element.exportData('csv');
  const canvas = element.shadowRoot!.querySelector('canvas')!;
  const original = Object.getOwnPropertyDescriptor(canvas, 'toDataURL');
  Object.defineProperty(canvas, 'toDataURL', { configurable: true, value() {
    throw new DOMException('Canvas cannot be encoded', 'SecurityError');
  } });
  try {
    expect(element.exportData('png')).to.equal('');
    expect(element.exportData('csv')).to.equal(csv);
    expect(csv).to.include('7');
  } finally {
    if (original) Object.defineProperty(canvas, 'toDataURL', original);
    else delete (canvas as unknown as { toDataURL?: unknown }).toDataURL;
  }
  expect(element.exportData('png')).to.match(/^data:image\/png/);
});

it('distinguishes absent untyped legend entries while keeping repeated bindings stable', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap></lr-heatmap>`);
  element.legendStops = [null] as unknown as LyraHeatmap['legendStops'];
  await element.updateComplete;
  element.legendStops = [null] as unknown as LyraHeatmap['legendStops'];
  expect(element.isUpdatePending).to.equal(false);
  element.legendStops = [undefined] as unknown as LyraHeatmap['legendStops'];
  expect(element.isUpdatePending).to.equal(true);
  await element.updateComplete;
  element.legendStops = [{ value: 7, label: 'Recovered' }];
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="legend-stop-label"]')?.textContent).to.equal('Recovered');
});
