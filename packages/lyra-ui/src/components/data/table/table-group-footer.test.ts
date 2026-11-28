import { fixture, expect, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks } from '../../../../test/table.js';
installTableTestHooks();

interface Sale {
  id: string;
  region: string;
  item: string;
  amount: number;
}

const sales: Sale[] = [
  { id: 'n1', region: 'North', item: 'Pens', amount: 5 },
  { id: 'n2', region: 'North', item: 'Ink', amount: 20 },
  { id: 's1', region: 'South', item: 'Paper', amount: 7 },
  { id: 's2', region: 'South', item: 'Clips', amount: 1 },
  { id: 's3', region: 'South', item: 'Tape', amount: 3 },
];

const sum = (rows: readonly Sale[]): number => rows.reduce((total, row) => total + row.amount, 0);

const saleColumns: TableColumn<Sale>[] = [
  { key: 'item', label: 'Item', sortable: true, cell: (row) => row.item },
  { key: 'amount', label: 'Amount', align: 'end', sortable: true, cell: (row) => row.amount, footer: (rows) => `Σ ${sum(rows)}` },
];

async function groupedTable(configure?: (el: LyraTable<Sale>) => void, dir: 'ltr' | 'rtl' = 'ltr'): Promise<LyraTable<Sale>> {
  const el = await fixture<LyraTable<Sale>>(html`<lr-table aria-label="Sales" dir=${dir}></lr-table>`);
  el.columns = saleColumns;
  el.rows = sales;
  el.rowKey = (row) => row.id;
  el.groupBy = (row) => row.region;
  configure?.(el);
  await el.updateComplete;
  return el;
}

/** Body row sequence as compact strings: `G:<label>`, `R:<id>` or `F:<cell texts>`. */
function bodySequence(el: LyraTable<Sale>): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody > tr')].map((tr) => {
    const part = tr.getAttribute('part');
    if (part === 'group-row') return `G:${tr.textContent!.trim()}`;
    if (part === 'group-footer')
      return `F:${[...tr.querySelectorAll('[part="group-footer-cell"]')].map((cell) => cell.textContent!.trim()).join('|')}`;
    return `R:${tr.getAttribute('data-row-key')!.replace(/^string:/, '')}`;
  });
}

it('renders no group footer rows while groupFooter is unset (unset-regression)', async () => {
  const el = await groupedTable();
  expect(el.shadowRoot!.querySelectorAll('[part="group-footer"]').length).to.equal(0);
  expect(bodySequence(el)).to.deep.equal(['G:North', 'R:n1', 'R:n2', 'G:South', 'R:s1', 'R:s2', 'R:s3']);
  expect(el.shadowRoot!.querySelectorAll('[part="footer-row"]').length).to.equal(1);
});

it('reuses each column footer(rows) per group when groupFooter is true', async () => {
  const el = await groupedTable((table) => {
    table.groupFooter = true;
  });
  expect(bodySequence(el)).to.deep.equal(['G:North', 'R:n1', 'R:n2', 'F:|Σ 25', 'G:South', 'R:s1', 'R:s2', 'R:s3', 'F:|Σ 11']);
  // The table-wide footer still aggregates every row.
  expect(el.shadowRoot!.querySelector('[part="footer-row"]')!.textContent).to.contain('Σ 36');
  const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="group-footer-cell"][data-col-key="amount"]')!;
  expect(cell.dataset['align']).to.equal('end');
});

it('renders a groupFooter callback record keyed by column, skipping groups that return null', async () => {
  const seen: string[] = [];
  const el = await groupedTable((table) => {
    table.groupFooter = (key, rows) => {
      seen.push(`${key}:${rows.length}`);
      return key === 'North' ? null : { item: html`<em>${rows.length} items</em>`, amount: sum(rows) };
    };
  });
  expect(seen).to.deep.equal(['North:2', 'South:3']);
  expect(bodySequence(el)).to.deep.equal(['G:North', 'R:n1', 'R:n2', 'G:South', 'R:s1', 'R:s2', 'R:s3', 'F:3 items|11']);
  expect(el.shadowRoot!.querySelector('[part="group-footer-cell"] em')).to.not.equal(null);
});

it('fills the row-total column from grandTotal(groupRows) when groupFooter is true', async () => {
  const el = await groupedTable((table) => {
    table.groupFooter = true;
    table.rowTotal = (row) => row.amount * 2;
    table.grandTotal = (rows) => `T ${sum(rows) * 2}`;
  });
  const footers = [...el.shadowRoot!.querySelectorAll('[part="group-footer"]')];
  expect(footers.map((row) => row.lastElementChild!.textContent!.trim())).to.deep.equal(['T 50', 'T 22']);
  expect(footers[0]!.children.length).to.equal(3);
});

it('keeps each group footer at its group end under client sorting, recomputed from the sorted group', async () => {
  const el = await groupedTable((table) => {
    table.groupFooter = (_key, rows) => ({ item: rows.map((row) => row.item).join(','), amount: sum(rows) });
    table.sortKey = 'amount';
    table.sortDir = 'desc';
  });
  expect(bodySequence(el)).to.deep.equal([
    'G:North', 'R:n2', 'R:n1', 'F:Ink,Pens|25',
    'G:South', 'R:s1', 'R:s3', 'R:s2', 'F:Paper,Tape,Clips|11',
  ]);
  el.sortDir = 'asc';
  await el.updateComplete;
  expect(bodySequence(el)).to.deep.equal([
    'G:North', 'R:n1', 'R:n2', 'F:Pens,Ink|25',
    'G:South', 'R:s2', 'R:s3', 'R:s1', 'F:Clips,Tape,Paper|11',
  ]);
});

it('summarizes the whole filtered group and renders it only on the page holding its last row', async () => {
  const el = await groupedTable((table) => {
    table.groupFooter = true;
    table.pageSize = 3;
  });
  expect(bodySequence(el)).to.deep.equal(['G:North', 'R:n1', 'R:n2', 'F:|Σ 25', 'G:South', 'R:s1']);
  el.page = 2;
  await el.updateComplete;
  expect(bodySequence(el)).to.deep.equal(['G:South', 'R:s2', 'R:s3', 'F:|Σ 11']);
  el.filterText = 'Pens';
  el.page = 1;
  await el.updateComplete;
  expect(bodySequence(el)).to.deep.equal(['G:North', 'R:n1', 'F:|Σ 5']);
});

it('keeps group footers out of selection, row data and roving focus', async () => {
  const el = await groupedTable((table) => {
    table.groupFooter = true;
    table.selectionMode = 'multiple';
  });
  const footer = el.shadowRoot!.querySelector<HTMLElement>('[part="group-footer"]')!;
  expect(footer.hasAttribute('data-row-key')).to.equal(false);
  expect(footer.hasAttribute('aria-selected')).to.equal(false);
  expect(footer.hasAttribute('tabindex')).to.equal(false);
  let changes = 0;
  el.addEventListener('lr-selection-change', () => changes++);
  footer.querySelector<HTMLElement>('[part="group-footer-cell"]')!.click();
  await el.updateComplete;
  expect(changes).to.equal(0);
  expect(el.selectedRowKeys.size).to.equal(0);
  expect(el.viewRows.length).to.equal(5);
  expect(el.pageRows.length).to.equal(5);

  // ArrowDown from the group's last row skips the footer and the next group header.
  const bodyRows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  await focusByKeyboard(bodyRows[1]!);
  await sendKeys({ press: 'ArrowDown' });
  await el.updateComplete;
  const focused = el.shadowRoot!.activeElement as HTMLElement;
  expect(focused.getAttribute('part')).to.equal('row');
  expect(focused === bodyRows[2]).to.equal(true);
});

for (const direction of ['ltr', 'rtl'] as const) {
  it(`exposes a localized total row that passes axe in ${direction}`, async () => {
    const el = await groupedTable((table) => {
      table.groupFooter = true;
      if (direction === 'rtl') table.strings = { tableRowTotal: 'Totale' };
    }, direction);
    const footer = el.shadowRoot!.querySelector<HTMLElement>('[part="group-footer"]')!;
    expect(footer.getAttribute('role')).to.equal('row');
    expect(footer.getAttribute('aria-roledescription')).to.equal(direction === 'rtl' ? 'Totale' : 'Total');
    for (const cell of footer.querySelectorAll('[part="group-footer-cell"]')) expect(cell.getAttribute('role')).to.equal('gridcell');
    const amount = footer.querySelector<HTMLElement>('[data-col-key="amount"]')!;
    const item = footer.querySelector<HTMLElement>('[data-col-key="item"]')!;
    // Logical alignment: the end-aligned cell sits on the inline-end side in either direction.
    const amountRect = amount.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    expect(direction === 'rtl' ? amountRect.right <= itemRect.left + 1 : amountRect.left >= itemRect.right - 1).to.equal(true);
    expect(getComputedStyle(amount).textAlign).to.equal('end');
    await expect(el).to.be.accessible();
  });
}

it('renders group footers as blocks in the stacked layout', async () => {
  const el = await groupedTable((table) => {
    table.groupFooter = true;
    table.stack = 'always';
  });
  const footer = el.shadowRoot!.querySelector<HTMLElement>('[part="group-footer"]')!;
  expect(getComputedStyle(footer).display).to.equal('block');
  expect(getComputedStyle(footer.querySelector('[part="group-footer-cell"]')!).display).to.equal('block');
});

it('ignores groupFooter without groupBy', async () => {
  const el = await groupedTable((table) => {
    table.groupBy = undefined;
    table.groupFooter = true;
  });
  expect(el.shadowRoot!.querySelectorAll('[part="group-footer"]').length).to.equal(0);
});
