import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.class.js';

it('preserves generated table rows across selection-only updates', async () => {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['a','b']}
    .datasets=${[{label:'S', data:[1,2]}]}></lr-lite-chart>`);
  const seam = el as unknown as { renderDataTableRows(): unknown };
  const before = seam.renderDataTableRows();
  el.selectedIndices = [1];
  await el.updateComplete;
  expect(seam.renderDataTableRows() === before).to.equal(true);
});

it('appends a canonical retained window without walking its property descriptors', async () => {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${Array.from({length:1000}, (_,i)=>String(i))}
    .datasets=${[{label:'S',data:Array.from({length:1000},(_,i)=>i)}]}></lr-lite-chart>`);
  const original = Object.getOwnPropertyDescriptor;
  let reads = 0;
  Object.getOwnPropertyDescriptor = function (...args: Parameters<typeof original>) { reads++; return original(...args); };
  try {
    el.appendData('next', [1001], 1000);
  } finally { Object.getOwnPropertyDescriptor = original; }
  expect(reads).to.be.lessThan(1100);
  recordScaleMeasurement('lr-lite-chart', '1000 retained points append', { descriptorReads: reads });
  expect(el.datasets[0]!.data.length).to.equal(1000);
  expect(el.datasets[0]!.data[0]).to.equal(1);
  expect(el.datasets[0]!.data[999]).to.equal(1001);
});

it('skips axis measurements for a selection-only update', async () => {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['a','b']}
    .datasets=${[{label:'S',data:[1,2]}]}></lr-lite-chart>`);
  const seam = el as unknown as { fitCategoryLabels(): void };
  const original = seam.fitCategoryLabels;
  let fits = 0;
  seam.fitCategoryLabels = () => { fits++; };
  try { el.selectedIndices = [1]; await el.updateComplete; }
  finally { seam.fitCategoryLabels = original; }
  expect(fits).to.equal(0);
});

it('writes all interior tick candidates before measuring their lengths', async () => {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['Alpha','Bravo','Charlie']}
    .datasets=${[{label:'S',data:[1,2,3]}]}></lr-lite-chart>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="axis-label"][data-full-label]').length === 3);
  const ticks = [...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-label"][data-full-label]')];
  expect(ticks.length).to.equal(3);
  let firstRead = true;
  let allReset = false;
  for (const tick of ticks) {
    tick.setAttribute('text-anchor', 'middle');
    const text = [...tick.childNodes].find(node => node.nodeType === 3) as Text;
    text.data = '…';
    tick.getComputedTextLength = () => {
      if (firstRead) {
        firstRead = false;
        allReset = ticks.every(item => item.textContent === item.getAttribute('data-full-label'));
      }
      return tick.textContent!.length * 5;
    };
  }
  (el as unknown as { fitCategoryLabels(): void }).fitCategoryLabels();
  expect(allReset).to.equal(true);
});

it('discloses admission loss separately from sampling and clears it on replacement', async () => {
  expectDevWarning('lr-chart-series-cap');
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart
    .strings=${{ chartInputLimit: 'Input was limited.' }}
    .datasets=${[{label:'S',data:Array.from({length:10_001},()=>1)}]}></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.include('Input was limited.');
  el.datasets = [{label:'S',data:[1]}];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent ?? '').not.to.include('Input was limited.');
});

it('reuses synchronized category positions on selection updates', async () => {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart sync-group="positions"
    .labels=${['a','b']} .datasets=${[{label:'S',data:[1,2]}]}></lr-lite-chart>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bar"]').length === 2);
  const seam = el as unknown as { syncCategoryPositions: Map<number, number> };
  const before = seam.syncCategoryPositions;
  el.selectedIndices = [1]; await el.updateComplete;
  expect(seam.syncCategoryPositions === before).to.equal(true);
});


it('keeps the visible accessible table current immediately after append', async () => {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart with-data-table .labels=${['a']}
    .datasets=${[{label:'S',data:[1]}, {label:'T',data:[2]}]}></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelector('table')!.classList.contains('sr-only')).to.equal(false);
  el.appendData('b', [41, 42]);
  await el.updateComplete;
  const last = el.shadowRoot!.querySelector('tbody tr:last-child')!;
  expect(last.querySelector('th')!.textContent).to.equal('b');
  expect([...last.querySelectorAll('td')].map(cell => cell.textContent)).to.deep.equal(['41', '42']);
  expect(el.shadowRoot!.querySelector('table')!.hasAttribute('aria-hidden')).to.equal(false);
});

it('accepts the original external binding again after an internal append', async () => {
  const datasets = [{label:'S',data:[1]}];
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['a']} .datasets=${datasets}></lr-lite-chart>`);
  el.appendData('b', [2]);
  el.datasets = datasets;
  await el.updateComplete;
  expect([...el.datasets[0]!.data]).to.deep.equal([1]);
});
