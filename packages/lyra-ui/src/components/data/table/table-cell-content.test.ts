import { fixture, expect, html } from '@open-wc/testing';
import { LitElement, css } from 'lit';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, rows } from '../../../../test/table.js';
installTableTestHooks();

// A consumer component that owns an <lr-table> in its own shadow root and styles the cell
// content from its own stylesheet -- the case a plain class inside cell() cannot serve, because
// cell() templates render inside the table's shadow root.
class TableCellContentOwner extends LitElement {
  static override styles = css`
    lr-table::part(cell-muted) {
      color: rgb(160, 0, 0);
    }
    lr-table::part(cell-content-clamped) {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }
    .muted {
      color: rgb(0, 96, 0);
    }
  `;

  columns: TableColumn<Row>[] = [];

  override render() {
    return html`<lr-table aria-label="Rows" .columns=${this.columns} .rows=${rows} .rowKey=${(r: Row) => r.id}></lr-table>`;
  }
}
if (!customElements.get('table-cell-content-owner')) {
  customElements.define('table-cell-content-owner', TableCellContentOwner);
}

async function ownedTable(columns: TableColumn<Row>[]): Promise<LyraTable<Row>> {
  const owner = document.createElement('table-cell-content-owner') as TableCellContentOwner;
  owner.columns = columns;
  await fixture(html`<div style="inline-size: 480px">${owner}</div>`);
  await owner.updateComplete;
  const table = owner.shadowRoot!.querySelector<LyraTable<Row>>('lr-table')!;
  await table.updateComplete;
  return table;
}

function firstCell(table: LyraTable<Row>, key: string): HTMLElement {
  return table.shadowRoot!.querySelector<HTMLElement>(`[part="cell"][data-col-key="${key}"]`)!;
}

describe('lr-table cell content hooks', () => {
  it('renders cell() output inside the table shadow root, out of reach of the owner class rules', async () => {
    const table = await ownedTable([
      { key: 'name', label: 'Name', cell: (r) => html`<span class="muted">${r.name}</span>` },
    ]);
    const span = firstCell(table, 'name').querySelector<HTMLElement>('.muted');
    expect(span?.getRootNode() === table.shadowRoot).to.equal(true);
    expect(getComputedStyle(span!).color).to.not.equal('rgb(0, 96, 0)');
  });

  it('wraps the content in [part~="cell-content"] plus the names cellPart(row) returns', async () => {
    const table = await ownedTable([
      {
        key: 'name',
        label: 'Name',
        cellPart: (r) => (r.score > 2 ? 'cell-muted  cell-content-clamped' : undefined),
        cell: (r) => r.name,
      },
    ]);
    const wrappers = [...table.shadowRoot!.querySelectorAll<HTMLElement>('[part~="cell-content"]')];
    expect(wrappers.map((w) => w.getAttribute('part')!.trim().split(/\s+/))).to.deep.equal([
      ['cell-content', 'cell-muted', 'cell-content-clamped'],
      ['cell-content'],
    ]);
    expect(wrappers.map((w) => w.textContent!.trim())).to.deep.equal(['Alpha', 'Beta']);
    expect(getComputedStyle(wrappers[0]!).color).to.equal('rgb(160, 0, 0)');
    expect(getComputedStyle(wrappers[0]!).webkitLineClamp).to.equal('2');
    expect(getComputedStyle(wrappers[1]!).color).to.not.equal('rgb(160, 0, 0)');
    // The wrapper is the content box of the cell, so a clamp or nowrap rule has a block to act on.
    expect(getComputedStyle(wrappers[1]!).display).to.equal('block');
  });

  it('exposes a part attribute written inside a cell() template as a table part', async () => {
    const table = await ownedTable([
      { key: 'name', label: 'Name', cell: (r) => html`<span part="cell-muted">${r.name}</span>` },
    ]);
    const span = firstCell(table, 'name').querySelector<HTMLElement>('[part="cell-muted"]')!;
    expect(getComputedStyle(span).color).to.equal('rgb(160, 0, 0)');
  });

  it('renders no wrapper when cellPart is unset, and ignores blank or non-string results', async () => {
    const table = await ownedTable([
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        cellPart: (r) => (r.score > 2 ? '   ' : (42 as unknown as string)),
        cell: (r) => r.score,
      },
    ]);
    expect(firstCell(table, 'name').querySelector('[part~="cell-content"]') === null).to.equal(true);
    const parts = [...table.shadowRoot!.querySelectorAll('[part~="cell-content"]')].map((w) =>
      w.getAttribute('part')!.trim()
    );
    expect(parts).to.deep.equal(['cell-content', 'cell-content']);
  });

  it('keeps the wrapper out of an open inline editor and passes axe with wrapped content', async () => {
    const table = await ownedTable([
      {
        key: 'name',
        label: 'Name',
        editTrigger: 'double-click',
        cellPart: () => 'cell-muted',
        cell: (r) => r.name,
      },
    ]);
    expect(table.shadowRoot!.querySelectorAll('[part~="cell-content"]')).to.have.lengthOf(2);
    await expect(table).to.be.accessible();
    table.editCell('a', 'name');
    await table.updateComplete;
    const cell = firstCell(table, 'name');
    expect(cell.querySelector('[part="cell-editor"]') !== null).to.equal(true);
    expect(cell.querySelector('[part~="cell-content"]') === null).to.equal(true);
  });
});
