import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, columns, rows } from '../../../../test/table.js';
installTableTestHooks();

const longRows: Row[] = [{ id: 'a', name: 'Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel', score: 3 }];

async function make(style = '', cols: TableColumn<Row>[] = columns, attrs = '', width = '640px', data = rows): Promise<LyraTable<Row>> {
  const wrap = await fixture<HTMLElement>(html`<div style="inline-size: ${width}"></div>`);
  wrap.innerHTML = `<lr-table aria-label="Accounts" sort-key="name" style="${style}" ${attrs}></lr-table>`;
  const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
  el.columns = cols;
  el.rows = data;
  el.rowKey = (r: Row) => r.id;
  await el.updateComplete;
  return el;
}
const cs = (el: LyraTable<Row>, selector: string) => getComputedStyle(el.shadowRoot!.querySelector(selector)!);

describe('lr-table frame, line-height and sort-icon tokens', () => {
  it('draws the frame from --lr-table-border, keeping the subtle hairline by default', async () => {
    const plain = await make();
    const base = cs(plain, '[part="base"]');
    expect(base.borderTopStyle).to.equal('solid');
    const reference = await make('border-top: 1px solid var(--lr-color-border-subtle)');
    expect(base.borderTopColor).to.equal(getComputedStyle(reference).borderTopColor);
    const tuned = await make('--lr-table-border: 3px dashed rgb(1, 2, 3)');
    const tunedBase = cs(tuned, '[part="base"]');
    expect(tunedBase.borderTopWidth).to.equal('3px');
    expect(tunedBase.borderInlineStartStyle).to.equal('dashed');
    expect(tunedBase.borderBottomColor).to.equal('rgb(1, 2, 3)');
    const none = await make('--lr-table-border: none');
    expect(cs(none, '[part="base"]').borderTopStyle).to.equal('none');
  });

  it('sets body cell line height from --lr-table-cell-line-height, inheriting by default', async () => {
    const plain = await make('line-height: 30px');
    expect(cs(plain, '[part="cell"]').lineHeight).to.equal('30px');
    const tuned = await make('line-height: 30px; --lr-table-cell-line-height: 12px');
    expect(cs(tuned, '[part="cell"]').lineHeight).to.equal('12px');
    expect(cs(tuned, '[part="header-cell"]').lineHeight, 'header untouched').to.equal('30px');
  });

  it('aligns the sort icon from --lr-table-sort-icon-vertical-align, middle by default', async () => {
    const plain = await make();
    expect(cs(plain, '[part~="sort-icon"]').verticalAlign).to.equal('middle');
    const tuned = await make('--lr-table-sort-icon-vertical-align: text-bottom');
    expect(cs(tuned, '[part~="sort-icon"]').verticalAlign).to.equal('text-bottom');
  });
});

describe('lr-table columns[].wrap', () => {
  const wrapColumns = (wrap?: 'wrap' | 'nowrap'): TableColumn<Row>[] => [
    { key: 'name', label: 'Name', ...(wrap ? { wrap } : {}), footer: () => 'Total of a very long footer label', cell: (r) => r.name },
    { key: 'score', label: 'Score', cell: (r) => String(r.score) },
  ];

  it("'nowrap' keeps the column's body and footer cells on one line", async () => {
    const el = await make('', wrapColumns('nowrap'), '', '200px', longRows);
    const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-col-key="name"]')!;
    expect(cell.dataset['wrap']).to.equal('nowrap');
    expect(getComputedStyle(cell).whiteSpace).to.equal('nowrap');
    expect(cs(el, '[part="footer-cell"][data-col-key="name"]').whiteSpace).to.equal('nowrap');
    expect(cs(el, '[part="cell"][data-col-key="score"]').whiteSpace, 'other columns unchanged').to.equal('normal');
    const lineHeight = parseFloat(getComputedStyle(cell).lineHeight) || 20;
    expect(cell.getBoundingClientRect().height).to.be.lessThan(lineHeight * 2 + 24);
  });

  it("'wrap' breaks long unbroken values inside a narrow column", async () => {
    const data: Row[] = [{ id: 'a', name: 'Supercalifragilisticexpialidocious-and-more-characters', score: 3 }];
    const cols: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', wrap: 'wrap', width: '80px', cell: (r) => r.name },
      { key: 'score', label: 'Score', cell: (r) => String(r.score) },
    ];
    const el = await make('', cols, '', '300px', data);
    const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-col-key="name"]')!;
    expect(getComputedStyle(cell).overflowWrap).to.equal('anywhere');
    expect(cell.scrollWidth).to.be.at.most(cell.clientWidth + 1);
  });

  it('wraps a nowrap column while stacked so a card never scrolls sideways, LTR and RTL at 320px', async () => {
    for (const dir of ['ltr', 'rtl']) {
      const el = await make('', wrapColumns('nowrap'), `stack="always" dir="${dir}"`, '320px', longRows);
      expect(cs(el, '[part="cell"][data-col-key="name"]').whiteSpace).to.equal('normal');
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      expect(base.scrollWidth, dir).to.be.at.most(base.clientWidth + 1);
      await expect(el).to.be.accessible();
    }
  });

  it('ignores unknown values and is unchanged when unset (regression)', async () => {
    const el = await make('', [{ key: 'name', label: 'Name', wrap: 'sideways' as 'wrap', cell: (r) => r.name }]);
    expect(el.shadowRoot!.querySelector('[data-wrap]') === null).to.equal(true);
    const plain = await make('', wrapColumns());
    expect(plain.shadowRoot!.querySelector('[data-wrap]') === null).to.equal(true);
    expect(cs(plain, '[part="cell"]').whiteSpace).to.equal('normal');
  });
});
