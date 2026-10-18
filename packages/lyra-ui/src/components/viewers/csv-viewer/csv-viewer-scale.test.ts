import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraCsvViewer } from './csv-viewer.class.js';
import './csv-viewer.js';

type ViewerSeam = {
  fetchState: unknown;
  renderCell(...args: unknown[]): unknown;
  table: { setActiveRow(key: number): void };
};

async function populated(): Promise<LyraCsvViewer> {
  const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer style="width:400px" max-height="240px"></lr-csv-viewer>`);
  const fields = Array.from({ length: 100 }, (_, col) => `Column ${col}`);
  const rows = Array.from({ length: 1000 }, (_, row) => fields.map((_, col) => `CELL ${row} ${col}`));
  (el as unknown as ViewerSeam).fetchState = { kind: 'loaded', rows };
  await el.updateComplete;
  await (el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

describe('lr-csv-viewer scale', () => {
  it('windows columns within the allocated inline size', async () => {
    const el = await populated();
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const row = list.shadowRoot!.querySelector('[part="data-row"]')!;
    const cells = row.querySelectorAll('[role="cell"]').length;
    recordScaleMeasurement('lr-csv-viewer', 'columns@1000x100', { cells });
    expect(cells).to.be.at.most(30);
  });

  it('keeps cell templates stable when only the active row moves', async () => {
    const el = await populated();
    const seam = el as unknown as ViewerSeam;
    const original = seam.renderCell;
    let cells = 0;
    seam.renderCell = function (...args) { cells++; return original.apply(this, args); };
    try {
      seam.table.setActiveRow(1);
      await el.updateComplete;
      await (el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      recordScaleMeasurement('lr-csv-viewer', 'active-row@1000x100', { cells });
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
      recordScaleMeasurement('lr-csv-viewer', 'search@1000x100', { folds });
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

it('reuses the admitted column count when revealing a cell', async () => {
  const el = await populated();
  const rows = (el as unknown as { fetchState: { rows: unknown[][] } }).fetchState.rows;
  const reduce = rows.reduce;
  let reductions = 0;
  rows.reduce = function (this: unknown[][], ...args: unknown[]) { reductions++; return Reflect.apply(reduce, this, args); } as typeof rows.reduce;
  try {
    expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A3' })).to.equal(true);
    recordScaleMeasurement('lr-csv-viewer', 'anchor-column-count@1000x100', { reductions });
    expect(reductions).to.equal(0);
  } finally { rows.reduce = reduce; }
});
