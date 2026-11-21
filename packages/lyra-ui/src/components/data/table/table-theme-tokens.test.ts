import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, rows } from '../../../../test/table.js';
installTableTestHooks();

const columns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name, sticky: 'start', footer: () => 'Total' },
  { key: 'score', label: 'Score', cell: (r) => String(r.score), sortable: true },
];

async function table(style = ''): Promise<LyraTable<Row>> {
  const el = await fixture<LyraTable<Row>>(html`<lr-table
    aria-label="Rows" style=${style} sort-key="score" .columns=${columns} .rows=${rows} .rowKey=${(r: Row) => r.id}
  ></lr-table>`);
  await el.updateComplete;
  return el;
}
const cs = (el: LyraTable<Row>, selector: string) => getComputedStyle(el.shadowRoot!.querySelector(selector)!);

describe('lr-table header and rule tokens', () => {
  it('routes the header and cell-rule tokens to every header cell and row rule', async () => {
    const el = await table(
      '--lr-table-header-font-weight: 300; --lr-table-header-color: rgb(1, 2, 3); --lr-table-header-font-size: 21px; --lr-table-cell-border-color: rgb(9, 8, 7)',
    );
    const resting = cs(el, '[part="header-cell"]:not([aria-sort="ascending"]):not([aria-sort="descending"])');
    expect([resting.fontWeight, resting.color, resting.fontSize, resting.borderBottomColor])
      .to.deep.equal(['300', 'rgb(1, 2, 3)', '21px', 'rgb(9, 8, 7)']);
    // The sorted header falls back to the resting header color while its own token is unset.
    const sorted = cs(el, '[part="header-cell"][aria-sort="ascending"], [part="header-cell"][aria-sort="descending"]');
    expect(sorted.color).to.equal('rgb(1, 2, 3)');
    expect(cs(el, '[part="cell"]').borderBottomColor).to.equal('rgb(9, 8, 7)');
    expect(cs(el, '[part="footer-cell"]').borderTopColor).to.equal('rgb(9, 8, 7)');
    expect(cs(el, '[part="cell"][data-sticky]').boxShadow).to.contain('rgb(9, 8, 7)');
  });

  it('keeps the current header weight, inherited color and subtle rule when unset', async () => {
    const el = await table();
    const header = cs(el, '[part="header-cell"]');
    expect(header.fontWeight).to.equal('600');
    expect(header.color).to.equal(getComputedStyle(el).color);
    expect(header.fontSize).to.equal(getComputedStyle(el).fontSize);
    const probe = document.createElement('span');
    probe.style.color = 'var(--lr-color-border-subtle)';
    el.shadowRoot!.append(probe);
    const subtle = getComputedStyle(probe).color;
    probe.remove();
    expect(cs(el, '[part="cell"]').borderBottomColor).to.equal(subtle);
    expect(header.borderBottomColor).to.equal(subtle);
  });
});
