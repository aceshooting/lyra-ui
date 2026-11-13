import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTabularReadRequest, LyraTabularSource, LyraTabularHit } from '../../data-sources.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import './csv-viewer/csv-viewer.js';

function source(label: string): LyraTabularSource {
  return { revision: 1, rowCount: 3, columnCount: 2,
    columnAt: index => ({ key: String(index), label: `Column ${index}` }),
    cellAt: (row, column) => `${label}:${row}:${column}`,
    search: async () => ({ hits: [{ row: 1, column: 1 }], total: 1, exhaustive: true }) };
}
function text(viewer: LyraCsvViewer): string {
  return viewer.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.textContent ?? '';
}
async function mount(data: LyraTabularSource): Promise<{ viewer: LyraCsvViewer; errors: unknown[] }> {
  const errors: unknown[] = [];
  const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer style="display:block;width:400px"
    .dataSource=${data} @lr-render-error=${(event: CustomEvent<{ error: unknown }>) => errors.push(event.detail.error)}
  ></lr-csv-viewer>`);
  return { viewer, errors };
}

it('keeps a source installed by an abort listener while a changed revision is being bound', async () => {
  const requests: { request: LyraTabularReadRequest; resolve(value: readonly (readonly string[])[]): void }[] = [];
  const original: LyraTabularSource = { revision: 1, rowCount: 200, columnCount: 2,
    columnAt: index => ({ key: String(index), label: `Column ${index}` }),
    readCells: request => new Promise(resolve => requests.push({ request, resolve })) };
  const { viewer, errors } = await mount(original);
  await waitUntil(() => requests.length === 2);
  const replacement = source('replacement');
  let replacements = 0;
  requests[0]!.request.signal.addEventListener('abort', () => {
    replacements++; viewer.dataSource = replacement;
  }, { once: true });
  Reflect.set(original, 'revision', 2);
  viewer.maxColumns = 3;
  await waitUntil(() => requests.every(entry => entry.request.signal.aborted));
  expect(replacements).to.equal(1);
  expect(requests.every(entry => entry.request.signal.aborted)).to.equal(true);
  requests.forEach(entry => entry.resolve([]));
  await waitUntil(() => text(viewer).includes('replacement:0:0'));
  expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'B4' })).to.equal(true);
  expect(text(viewer)).to.include('replacement:2:1');
  expect(viewer.dataSource === replacement).to.equal(true);
  expect(errors.length).to.equal(0);
});

it('discards a search result whose iterator replaces the provider after yielding its last hit', async () => {
  const original = source('original');
  const { viewer, errors } = await mount(original);
  await waitUntil(() => text(viewer).includes('original:0:0'));
  const replacement = source('replacement');
  const hits: LyraTabularHit[] = [{ row: 2, column: 1 }];
  let iterations = 0;
  hits[Symbol.iterator] = function* (): Generator<LyraTabularHit, undefined, unknown> {
    iterations++; yield this[0]!; viewer.dataSource = replacement; return undefined;
  };
  original.search = async () => ({ hits, total: 1, exhaustive: true });
  const counts: number[] = [];
  viewer.addEventListener('lr-search-change', event => counts.push(event.detail.matchCount));
  expect(await viewer.search('original')).to.equal(0);
  await waitUntil(() => text(viewer).includes('replacement:0:0'));
  expect(iterations).to.equal(1);
  expect(counts.every(count => count === 0)).to.equal(true);
  expect(await viewer.search('replacement')).to.equal(1);
  expect(text(viewer)).to.include('replacement:1:1');
  expect(errors.length).to.equal(0);
});

it('does not start a provider search after its capability getter disconnects the viewer', async () => {
  const original = source('original');
  const { viewer, errors } = await mount(original);
  await waitUntil(() => text(viewer).includes('original:0:0'));
  const parent = viewer.parentNode!;
  let calls = 0, reads = 0;
  const search: NonNullable<LyraTabularSource['search']> = async () => {
    calls++; return { hits: [{ row: 1, column: 1 }], total: 1, exhaustive: true };
  };
  Object.defineProperty(original, 'search', { configurable: true, get() {
    reads++; viewer.remove(); return search;
  } });
  try {
    expect(await viewer.search('original')).to.equal(0);
    expect(reads).to.equal(1); expect(calls).to.equal(0);
  } finally {
    Object.defineProperty(original, 'search', { configurable: true, writable: true, value: search });
    parent.append(viewer);
  }
  await waitUntil(() => text(viewer).includes('original:0:0'));
  expect(await viewer.search('original')).to.equal(1);
  expect(calls).to.equal(1);
  expect(errors.length).to.equal(0);
});
