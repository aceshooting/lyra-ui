import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { installTableTestHooks, type Row, columns, rows, priorityColumns } from '../../../../test/table.js';
installTableTestHooks();

const linkColumns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name, href: (r) => `#/a/${r.id}` } as TableColumn<Row>,
];

async function make(attrs: string, style: string, cols: TableColumn<Row>[] = columns, width = ''): Promise<LyraTable<Row>> {
  const host = await fixture<HTMLElement>(html`<div style=${width}></div>`);
  host.innerHTML = `<lr-table aria-label="Rows" caption="Cap" ${attrs} style="${style}"></lr-table>`;
  const el = host.querySelector('lr-table') as LyraTable<Row>;
  el.columns = cols;
  el.rows = rows;
  el.rowKey = (r: Row) => r.id;
  await el.updateComplete;
  return el;
}
const cs = (el: LyraTable<Row>, selector: string) => getComputedStyle(el.shadowRoot!.querySelector(selector)!);

describe('lr-table filter tokens', () => {
  it('keeps the filter field unchanged while the tokens are unset', async () => {
    const el = await make('filterable', '');
    const filter = cs(el, '[part="filter"]');
    expect(filter.minHeight).to.equal('auto');
    expect(filter.fontSize).to.equal(getComputedStyle(el.shadowRoot!.querySelector('[part="filter-label"]')!).fontSize);
    expect(cs(el, '[part="filter-label"]').flexWrap).to.equal('nowrap');
  });

  it('sizes the filter from --lr-table-filter-height / -font-size and honours --lr-input-control-min-height', async () => {
    const el = await make('filterable', '--lr-table-filter-height: 3rem; --lr-table-filter-font-size: 20px');
    const filter = cs(el, '[part="filter"]');
    expect([filter.minHeight, filter.fontSize]).to.deep.equal(['48px', '20px']);
    const shared = await make('filterable', '--lr-input-control-min-height: 50px');
    expect(cs(shared, '[part="filter"]').minHeight).to.equal('50px');
    const own = await make('filterable', '--lr-input-control-min-height: 50px; --lr-table-filter-height: 60px');
    expect(cs(own, '[part="filter"]').minHeight).to.equal('60px');
  });

  it('stacks the field under its label at narrow widths when wrap and basis are set', async () => {
    const el = await make('filterable', '--lr-table-filter-wrap: wrap; --lr-table-filter-basis: 12rem', columns, 'width: 220px');
    const label = el.shadowRoot!.querySelector('[part="filter-label"]')!;
    const field = el.shadowRoot!.querySelector('[part="filter"]')!;
    expect(getComputedStyle(label).flexWrap).to.equal('wrap');
    await waitUntil(() => field.getBoundingClientRect().top > label.getBoundingClientRect().top + 8);
    const wide = await make('filterable', '--lr-table-filter-wrap: wrap; --lr-table-filter-basis: 12rem', columns, 'width: 900px');
    const wideField = wide.shadowRoot!.querySelector('[part="filter"]')!.getBoundingClientRect();
    const wideLabel = wide.shadowRoot!.querySelector('[part="filter-label"]')!.getBoundingClientRect();
    expect(wideField.top - wideLabel.top).to.be.lessThan(wideLabel.height / 2);
  });
});

describe('lr-table caption tokens', () => {
  it('keeps the UA caption look unset and applies the caption tokens when set', async () => {
    const plain = await make('', '');
    const base = cs(plain, '[part="caption"]');
    expect([base.textAlign.replace('-webkit-', ''), base.paddingTop, base.fontSize]).to.deep.equal(['center', '0px', getComputedStyle(plain).fontSize]);
    const el = await make(
      '',
      '--lr-table-caption-text-align: start; --lr-table-caption-font-size: 22px; --lr-table-caption-font-weight: 800; --lr-table-caption-color: rgb(1, 2, 3); --lr-table-caption-padding: 7px',
    );
    const c = cs(el, '[part="caption"]');
    expect([c.textAlign, c.fontSize, c.fontWeight, c.color, c.paddingLeft]).to.deep.equal(['start', '22px', '800', 'rgb(1, 2, 3)', '7px']);
  });
});

describe('lr-table reveal-columns min size', () => {
  it('raises the reveal-columns button to --lr-table-reveal-columns-min-size', async () => {
    const el = await make('', '--lr-table-reveal-columns-min-size: 64px', priorityColumns, 'width: 300px');
    await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);
    const button = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
    expect(button.getBoundingClientRect().height).to.be.at.least(64);
    expect(getComputedStyle(button).minInlineSize).to.equal('64px');
  });
});

describe('lr-table cell link tokens', () => {
  it('leaves the anchor at the UA underline and inherited weight while unset', async () => {
    const el = await make('', '', linkColumns);
    const a = cs(el, '[part="cell"] a');
    expect(a.textDecorationLine).to.equal('underline');
    expect(a.fontWeight).to.equal(getComputedStyle(el.shadowRoot!.querySelector('[part="cell"]')!).fontWeight);
  });

  it('applies weight and decoration tokens, with a separate hover variant', async () => {
    const el = await make(
      '',
      '--lr-table-cell-link-font-weight: 700; --lr-table-cell-link-text-decoration: none; --lr-table-cell-link-hover-text-decoration: underline; --lr-table-cell-link-hover-font-weight: 300',
      linkColumns,
    );
    const a = el.shadowRoot!.querySelector('[part="cell"] a') as HTMLElement;
    expect([getComputedStyle(a).fontWeight, getComputedStyle(a).textDecorationLine]).to.deep.equal(['700', 'none']);
    try {
      await hoverUntilMatched(a, 'cell link hover');
      await waitUntil(() => getComputedStyle(a).fontWeight === '300');
      expect(getComputedStyle(a).textDecorationLine).to.equal('underline');
    } finally {
      await resetMouse();
    }
  });
});
