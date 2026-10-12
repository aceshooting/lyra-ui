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

it('keeps PNG export empty when a pending data update flushes after disconnect', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="width: 400px" .data=${{
    kind: 'matrix', rowLabels: ['Row'], colLabels: ['Column'], values: [[7]],
  }}></lr-heatmap>`);
  await waitUntil(() => element.exportData('png').startsWith('data:image/png'), 'matrix was not painted');
  const parent = element.parentNode!;
  element.data = { kind: 'matrix', rowLabels: ['Row'], colLabels: ['Column'], values: [[8]] };
  element.remove();
  expect(element.isConnected).to.equal(false);
  expect(element.exportData('png')).to.equal('');
  await element.updateComplete;
  expect(element.isConnected).to.equal(false);
  expect(element.exportData('png').length, 'detached update must not publish a new PNG').to.equal(0);
  parent.appendChild(element);
  await waitUntil(() => element.exportData('png').startsWith('data:image/png'), 'reconnected matrix was not painted');
  expect(element.exportData('csv')).to.include('8');
});

it('keeps PNG export empty when disconnect itself schedules an update', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="width: 400px" .data=${{
    kind: 'matrix', rowLabels: ['Row'], colLabels: ['Column'], values: [[7]],
  }}></lr-heatmap>`);
  await waitUntil(() => element.exportData('png').startsWith('data:image/png'), 'matrix was not painted');
  // The focused cell cleared by disconnectedCallback schedules a draw-bearing Lit update.
  (element as unknown as { focusedCell: { row: number; col: number } | null }).focusedCell = { row: 0, col: 0 };
  await element.updateComplete;
  element.remove();
  expect(element.isUpdatePending).to.equal(true);
  expect(element.exportData('png')).to.equal('');
  await element.updateComplete;
  expect(element.isConnected).to.equal(false);
  expect(element.exportData('png').length, 'detached update must not publish a PNG').to.equal(0);
});

it('repaints the latest matrix on reconnect without ResizeObserver', async () => {
  const original = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined });
  try {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="width: 400px" .data=${{
      kind: 'matrix', rowLabels: ['Row'], colLabels: ['Column'], values: [[7]],
    }}></lr-heatmap>`);
    await waitUntil(() => element.exportData('png').startsWith('data:image/png'), 'initial matrix was not painted');
    const parent = element.parentNode!;
    element.remove();
    element.data = { kind: 'matrix', rowLabels: ['Row'], colLabels: ['Column'], values: [[8]] };
    await element.updateComplete;
    expect(element.exportData('png').length).to.equal(0);
    parent.appendChild(element);
    await waitUntil(() => element.exportData('png').startsWith('data:image/png'), 'reconnected matrix was not painted');
    expect(element.exportData('csv')).to.include('8');
  } finally {
    if (original) Object.defineProperty(window, 'ResizeObserver', original);
    else delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
  }
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
