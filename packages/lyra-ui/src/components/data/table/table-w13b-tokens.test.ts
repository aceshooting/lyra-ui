import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, columns, rows, priorityColumns } from '../../../../test/table.js';
installTableTestHooks();

async function make(style: string, cols: TableColumn<Row>[] = columns, extra = '', width = ''): Promise<LyraTable<Row>> {
  const host = await fixture<HTMLElement>(html`<div style=${width}></div>`);
  host.innerHTML = `<lr-table aria-label="Rows" ${extra} style="${style}"></lr-table>`;
  const el = host.querySelector('lr-table') as LyraTable<Row>;
  el.columns = cols;
  el.rows = rows;
  el.rowKey = (r: Row) => r.id;
  await el.updateComplete;
  return el;
}
const cs = (el: LyraTable<Row>, selector: string) => getComputedStyle(el.shadowRoot!.querySelector(selector)!);

describe('lr-table header, group and button fill tokens', () => {
  it('paints --lr-table-header-bg on header cells, yielding to the sorted fill', async () => {
    const el = await make('--lr-table-header-bg: rgb(1, 2, 3); --lr-table-header-sorted-bg: rgb(4, 5, 6)', columns, 'sort-key="score"');
    expect(cs(el, '[part="header-cell"]:not([aria-sort="ascending"]):not([aria-sort="descending"])').backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(cs(el, '[part="header-cell"][aria-sort="ascending"], [part="header-cell"][aria-sort="descending"]').backgroundColor).to.equal('rgb(4, 5, 6)');
  });

  it('paints --lr-table-group-bg on group cells', async () => {
    const el = await make('--lr-table-group-bg: rgb(7, 8, 9)');
    el.groupBy = (r) => (r.score > 2 ? 'Passing' : 'Needs review');
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector('[part="group-cell"]');
    expect(group, 'group cell renders').to.exist;
    expect(getComputedStyle(group!).backgroundColor).to.equal('rgb(7, 8, 9)');
  });

  it('draws the header rule in --lr-table-header-border-color, leaving body rules alone', async () => {
    const el = await make('--lr-table-header-border-color: rgb(10, 20, 30); --lr-table-cell-border-color: rgb(40, 50, 60)');
    expect(cs(el, '[part="header-cell"]').borderBottomColor).to.equal('rgb(10, 20, 30)');
    expect(cs(el, '[part="cell"]').borderBottomColor).to.equal('rgb(40, 50, 60)');
    const fallback = await make('--lr-table-cell-border-color: rgb(40, 50, 60)');
    expect(cs(fallback, '[part="header-cell"]').borderBottomColor).to.equal('rgb(40, 50, 60)');
  });

  it('fills the reveal-columns button from --lr-table-reveal-columns-bg', async () => {
    const el = await make('--lr-table-reveal-columns-bg: rgb(11, 12, 13)', priorityColumns, '', 'width: 300px');
    await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);
    expect(cs(el, '[part="reveal-columns-button"]').backgroundColor).to.equal('rgb(11, 12, 13)');
  });

  it('fills the more button from --lr-table-more-button-bg', async () => {
    const el = await make('--lr-table-more-button-bg: rgb(14, 15, 16)', columns, 'has-more');
    const button = el.shadowRoot!.querySelector('[part="more-button"]');
    expect(button, 'more button renders').to.exist;
    expect(getComputedStyle(button!).backgroundColor).to.equal('rgb(14, 15, 16)');
  });
});
