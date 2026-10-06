import { expect, html, nextFrame } from '@open-wc/testing';
import { render } from 'lit';
import './data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';
import type { LyraDataGrid } from './data-grid.js';
import { dataGrid } from '../../../../test/data-grid.js';

interface Item {
  id: number;
  name: string;
  score: number;
}

const ROWS = 2_000;
const items: Item[] = Array.from({ length: ROWS }, (_, index) => ({
  id: index,
  name: `Row ${index}`,
  score: (index * 7_919) % ROWS,
}));

describe('data-grid client pipeline', () => {
  it('sorts once per data update and never re-runs the pipeline for a scroll', async () => {
    let reads = 0;
    const columns: DataGridColumn<Item>[] = [
      { id: 'name', field: 'name', label: 'Name' },
      {
        id: 'score',
        label: 'Score',
        value: (row) => {
          reads += 1;
          return row.score;
        },
      },
    ];
    const element = await dataGrid<Item>(html`
      <lr-data-grid
        label="Pipeline"
        row-key="id"
        .columns=${columns}
        .data=${items}
        .sort=${[{ id: 'score', desc: false }]}
      ></lr-data-grid>
    `);
    await nextFrame();
    const rendered = element.shadowRoot!.querySelectorAll('[part~="row"]').length;
    expect(rendered, 'the body is virtualized').to.be.lessThan(200);

    reads = 0;
    element.sort = [{ id: 'score', desc: true }];
    await element.updateComplete;
    await nextFrame();
    // One decorated sort reads each row's value once; rendering reads the visible cells.
    expect(reads).to.be.lessThan(ROWS * 2);
    expect(element.getProcessedRows()[0]!.score).to.equal(ROWS - 1);

    reads = 0;
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    for (const top of [800, 1_600, 2_400]) {
      body.scrollTop = top;
      body.dispatchEvent(new Event('scroll'));
      await element.updateComplete;
    }
    await nextFrame();
    expect(reads, 'scrolling only renders newly visible cells').to.be.lessThan(ROWS / 4);
  });

  it('still reflects caller-owned row changes after requestUpdate()', async () => {
    const rows = [
      { id: 1, name: 'B', score: 1 },
      { id: 2, name: 'A', score: 2 },
    ];
    const element = await dataGrid<Item>(html`
      <lr-data-grid
        label="Mutable"
        row-key="id"
        .columns=${[{ id: 'name', field: 'name', label: 'Name' }] as DataGridColumn<Item>[]}
        .data=${rows}
        .sort=${[{ id: 'name', desc: false }]}
      ></lr-data-grid>
    `);
    expect(element.getProcessedRows().map((row) => row.id)).to.deep.equal([2, 1]);
    rows[0]!.name = 'C';
    rows[1]!.name = 'D';
    element.requestUpdate();
    await element.updateComplete;
    expect(element.getProcessedRows().map((row) => row.id)).to.deep.equal([1, 2]);
  });

  it('reads processed rows right after a data assignment, before the update runs', async () => {
    const element = await dataGrid<Item>(html`
      <lr-data-grid
        label="Sync"
        row-key="id"
        .columns=${[{ id: 'name', field: 'name', label: 'Name' }] as DataGridColumn<Item>[]}
        .data=${items.slice(0, 3)}
      ></lr-data-grid>
    `);
    element.data = items.slice(3, 5);
    expect(element.getProcessedRows().map((row) => row.id)).to.deep.equal([3, 4]);
    element.sort = [{ id: 'name', desc: true }];
    expect(element.getProcessedRows().map((row) => row.id)).to.deep.equal([4, 3]);
  });

  it('selects every row of a large grid with linear membership tests', async () => {
    const many: Item[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: index,
      name: `Row ${index}`,
      score: index,
    }));
    const element = await dataGrid<Item>(html`
      <lr-data-grid
        label="Select all"
        selectable="multiple"
        row-key="id"
        .columns=${[{ id: 'name', field: 'name', label: 'Name' }] as DataGridColumn<Item>[]}
        .data=${many}
      ></lr-data-grid>
    `);
    const cell = element.shadowRoot!.querySelector<HTMLElement>('[role="gridcell"][data-row-position="0"][data-column-position="0"]')!;
    let selected = 0;
    element.addEventListener('lr-row-select', (event) => {
      selected = event.detail.selectedRows.length;
    });
    const started = performance.now();
    cell.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, composed: true, cancelable: true })
    );
    await element.updateComplete;
    const elapsed = performance.now() - started;
    expect(selected).to.equal(10_000);
    expect(element.selectedKeys.length).to.equal(10_000);
    // A per-row scan over every selected key costs on the order of 10^8 comparisons here.
    expect(elapsed, `select-all took ${Math.round(elapsed)} ms`).to.be.lessThan(1_500);
  });
});


describe('data-grid collection rebinding', () => {
  it('ignores a parent re-render that rebinds the same arrays', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const data = items.slice(0, 5);
    const gridColumns: DataGridColumn<Item>[] = [{ id: 'name', field: 'name', label: 'Name' }];
    const keys = [1];
    const order = ['name'];
    const sizes = [5, 10];
    const template = () => html`<lr-data-grid
      label="Rebind"
      row-key="id"
      selectable="multiple"
      .columns=${gridColumns}
      .data=${data}
      .selectedRowKeys=${keys}
      .expandedRowKeys=${keys}
      .columnOrder=${order}
      .pageSizeOptions=${sizes}
      .groupBy=${null}
    ></lr-data-grid>`;
    render(template(), container);
    const grid = container.querySelector('lr-data-grid') as unknown as LyraDataGrid<Item>;
    // Let measurement-driven follow-up renders settle first.
    for (let frame = 0; frame < 3; frame += 1) {
      await grid.updateComplete;
      await nextFrame();
    }
    expect(grid.isUpdatePending).to.equal(false);
    render(template(), container);
    expect(grid.isUpdatePending).to.equal(false);
    container.remove();
  });

  it('keeps the shift-range anchor across a parent re-render', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const data = items.slice(0, 5);
    const gridColumns: DataGridColumn<Item>[] = [{ id: 'name', field: 'name', label: 'Name' }];
    const template = () => html`<lr-data-grid label="Range" row-key="id" selectable="multiple"
      .columns=${gridColumns} .data=${data}></lr-data-grid>`;
    render(template(), container);
    const grid = container.querySelector('lr-data-grid') as unknown as LyraDataGrid<Item>;
    await grid.updateComplete;
    const box = (row: number) =>
      grid.shadowRoot!.querySelectorAll<HTMLInputElement>('[part~="row"] input')[row]!;
    box(0).click();
    await grid.updateComplete;
    render(template(), container);
    await grid.updateComplete;
    box(2).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
    await grid.updateComplete;
    expect([...grid.selectedKeys]).to.deep.equal([0, 1, 2]);
    container.remove();
  });
});

describe('data-grid row budget', () => {
  it('reports truncation and keeps controlled selection of rows beyond the budget', async () => {
    const many: Item[] = Array.from({ length: 10_005 }, (_, index) => ({ id: index, name: `Row ${index}`, score: index }));
    const element = await dataGrid<Item>(html`
      <lr-data-grid
        label="Budget"
        row-key="id"
        selectable="multiple"
        .columns=${[{ id: 'name', field: 'name', label: 'Name' }] as DataGridColumn<Item>[]}
        .data=${many}
        .selectedRowKeys=${[3, 10_004]}
      ></lr-data-grid>
    `);
    expect(element.dataTruncated).to.equal(true);
    element.data = many.slice();
    await element.updateComplete;
    expect([...element.selectedKeys]).to.deep.equal([3, 10_004]);
    element.data = many.slice(0, 10);
    await element.updateComplete;
    expect(element.dataTruncated).to.equal(false);
    expect([...element.selectedKeys]).to.deep.equal([3]);
  });
});

describe('data-grid key inputs shared with lr-table', () => {
  it('accepts a Set for controlled key properties and a function rowKey', async () => {
    const element = await dataGrid<Item>(html`
      <lr-data-grid
        label="Keys"
        selectable="multiple"
        .columns=${[{ id: 'name', field: 'name', label: 'Name' }] as DataGridColumn<Item>[]}
        .data=${items.slice(0, 3)}
      ></lr-data-grid>
    `);
    element.rowKey = ((row: Item) => row.id) as unknown as string;
    element.selectedRowKeys = new Set([2]) as unknown as number[];
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(3);
    expect([...element.selectedKeys]).to.deep.equal([2]);
    expect(element.selectedRows.map((row) => row.id)).to.deep.equal([2]);
  });
});
