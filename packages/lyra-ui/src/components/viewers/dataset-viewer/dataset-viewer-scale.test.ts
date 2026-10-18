import { setViewport } from '@web/test-runner-commands';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraDatasetViewer } from './dataset-viewer.class.js';
import './dataset-viewer.js';

type ViewerSeam = {
  fetchState: unknown;
  renderCell(...args: unknown[]): unknown;
  tableController: { setActiveRow(key: number): void };
};

async function populated(): Promise<LyraDatasetViewer> {
  const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer style="width:400px" max-height="240px"></lr-dataset-viewer>`);
  const fields = Array.from({ length: 100 }, (_, col) => `Column ${col}`);
  const rows = Array.from({ length: 1000 }, (_, row) => fields.map((_, col) => `CELL ${row} ${col}`));
  (el as unknown as ViewerSeam).fetchState = { kind: 'loaded', table: { fields, rows: rows.map(row => Object.fromEntries(fields.map((field, col) => [field, row[col]]))) } };
  await el.updateComplete;
  await (el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

describe('lr-dataset-viewer scale', () => {
  it('windows columns within the allocated inline size', async () => {
    const el = await populated();
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const row = list.shadowRoot!.querySelector('[part="data-row"]')!;
    const cells = row.querySelectorAll('[role="cell"]').length;
    recordScaleMeasurement('lr-dataset-viewer', 'columns@1000x100', { cells });
    expect(cells).to.be.at.most(30);
  });

  it('keeps cell templates stable when only the active row moves', async () => {
    const el = await populated();
    const seam = el as unknown as ViewerSeam;
    const original = seam.renderCell;
    let cells = 0;
    seam.renderCell = function (...args) { cells++; return original.apply(this, args); };
    try {
      seam.tableController.setActiveRow(1);
      await el.updateComplete;
      await (el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      recordScaleMeasurement('lr-dataset-viewer', 'active-row@1000x100', { cells });
      expect(cells).to.equal(0);
    } finally { seam.renderCell = original; }
  });

  it('reuses folded cell text for a second search query', async () => {
    const el = await populated();
    await el.search('absent-one');
    const original = String.prototype.toLocaleLowerCase;
    let folds = 0;
    String.prototype.toLocaleLowerCase = function (...args) {
      if (String(this).startsWith('CELL ')) folds++;
      return Reflect.apply(original, this, args);
    };
    try {
      await el.search('absent-two');
      recordScaleMeasurement('lr-dataset-viewer', 'search@1000x100', { folds });
      expect(folds).to.equal(0);
    } finally { String.prototype.toLocaleLowerCase = original; }
  });
});

it('reveals a previously unmounted column through an anchor', async () => {
  const el = await populated();
  const found = await el.scrollToAnchor({ kind: 'cell-range', range: 'CV3' });
  expect(found).to.equal(true);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => !!list.shadowRoot!.querySelector('[aria-colindex="100"]'));
  expect(list.shadowRoot!.querySelectorAll('[part="data-row"] [role="cell"]').length).to.be.lessThan(1000);
});

it('fills the page viewport when a wide table overflows a narrow host', async () => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  await setViewport({ width: 1200, height: 800 });
  try {
    const el = await populated();
    el.style.width = '200px';
    el.scrollMode = 'page';
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('[part="header-row"]')!;
    const first = header.querySelector('[role="columnheader"]')!.getBoundingClientRect();
    const visibleColumns = Math.floor((window.innerWidth - first.left) / first.width);
    expect(header.querySelectorAll('[role="columnheader"]').length).to.be.at.least(visibleColumns);
  } finally { await setViewport(viewport); }
});

for (const direction of ['ltr', 'rtl']) it(`initializes and follows the ${direction} page's horizontal viewport`, async () => {
  const previousDirection = document.documentElement.getAttribute('dir');
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const previousScroll = { left: window.scrollX, top: window.scrollY };
  await setViewport({ width: 1200, height: 800 });
  document.documentElement.setAttribute('dir', direction);
  try {
    const fields = Array.from({ length: 100 }, (_, index) => `Column ${index}`);
    const table = { fields, rows: [Object.fromEntries(fields.map(field => [field, field]))] };
    const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer scroll-mode="page" style="width:200px" .table=${table}></lr-dataset-viewer>`);
    await el.updateComplete;
    window.scrollTo({ left: direction === 'rtl' ? -1024 : 1024, top: 0 });
    await waitUntil(() => Math.abs(window.scrollX) > 500);
    await waitUntil(() => !el.shadowRoot!.querySelector('[part="header-row"] [aria-colindex="1"]'));
    const mounted = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer scroll-mode="page" style="width:200px" .table=${table}></lr-dataset-viewer>`);
    await mounted.updateComplete;
    const header = mounted.shadowRoot!.querySelector('[part="header-row"]')!;
    expect(header.querySelector('[aria-colindex="1"]') === null).to.equal(true);
    expect(header.querySelectorAll('[role="columnheader"]').length).to.be.at.least(9).and.at.most(20);
    expect(await mounted.scrollToAnchor({ kind: 'cell-range', range: 'CV2' })).to.equal(true);
    const list = mounted.shadowRoot!.querySelector('lr-virtual-list')!;
    expect(list.shadowRoot!.querySelector('[aria-colindex="100"]')).to.exist;
  } finally {
    if (previousDirection === null) document.documentElement.removeAttribute('dir');
    else document.documentElement.setAttribute('dir', previousDirection);
    window.scrollTo(previousScroll);
    await setViewport(viewport);
  }
});
