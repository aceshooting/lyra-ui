import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './table.js';
import type { LyraTable, TableColumn } from './table.js';
import { installTableTestHooks, type Row, columns, editableColumns, rows } from '../../../../test/table.js';
installTableTestHooks();

async function mount(template = html`<lr-table></lr-table>`): Promise<LyraTable<Row>> {
  return (await fixture(template)) as LyraTable<Row>;
}

function key(name: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
}

describe('lr-table cell style hook boundaries', () => {
  it('leaves a cell unstyled when the hook returns nothing for its row', async () => {
    const el = await mount();
    el.columns = [{
      key: 'name', label: 'Name', cell: (r) => r.name,
      cellStyle: (r) => (r.score > 2 ? { background: 'red' } : undefined),
    }];
    el.rows = rows;
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    expect(cells[0]!.style.background).to.equal('red');
    expect(cells[1]!.style.background).to.equal('');
    expect(cells[1]!.style.length).to.equal(0);
  });

  it('keeps applying declarations after more than a thousand distinct ones have been checked', async () => {
    const many = Array.from({ length: 1_010 }, (_, index) => ({ id: `r${index}`, name: `Row ${index}`, score: index }));
    const el = await mount();
    el.columns = [{
      key: 'name', label: 'Name', cell: (r) => r.name,
      cellStyle: (r) => ({ width: `${r.score + 1}px` }),
    }];
    el.rowKey = (r) => r.id;
    el.pageSize = 500;
    el.rows = many;
    await el.updateComplete;
    const widths = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')].map((cell) => cell.style.width);
    expect(widths()[0]).to.equal('1px');
    el.page = 2;
    await el.updateComplete;
    expect(widths()[0]).to.equal('501px');
    el.page = 3;
    await el.updateComplete;
    expect(widths()).to.have.length(10);
    expect(widths()[0]).to.equal('1001px');
    expect(widths()[9]).to.equal('1010px');
    el.page = 1;
    await el.updateComplete;
    expect(widths()[0]).to.equal('1px');
    expect(widths()[499]).to.equal('500px');
  });
});

describe('lr-table footer boundaries', () => {
  it('renders an empty footer cell when a footer or grand-total callback returns nothing', async () => {
    const el = await mount();
    const footed: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name, footer: () => undefined },
      { key: 'score', label: 'Score', cell: (r) => r.score, footer: (all) => all.length },
    ];
    el.columns = footed;
    el.rows = rows;
    el.rowTotal = (r) => r.score;
    el.grandTotal = () => undefined;
    await el.updateComplete;
    const footer = [...el.shadowRoot!.querySelectorAll('[part="footer-cell"]')].map((cell) => cell.textContent!.trim());
    expect(footer).to.deep.equal(['', '2', '']);
  });
});

describe('lr-table keyboard boundaries', () => {
  it('leaves ArrowLeft and ArrowRight unhandled on a row with no editable cell', async () => {
    const el = await mount();
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
    for (const name of ['ArrowLeft', 'ArrowRight']) {
      const event = key(name);
      row.dispatchEvent(event);
      expect(event.defaultPrevented, name).to.equal(false);
    }
  });

  it('enters the editable cells from the far side for the backward key, in either reading direction', async () => {
    for (const [direction, enterFirst, enterLast] of [['ltr', 'ArrowRight', 'ArrowLeft'], ['rtl', 'ArrowLeft', 'ArrowRight']] as const) {
      const el = await mount(html`<lr-table dir=${direction}></lr-table>`);
      el.columns = editableColumns;
      el.rows = rows;
      el.rowKey = (r) => r.id;
      await el.updateComplete;
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
      const nameCell = el.shadowRoot!.querySelector<HTMLElement>('td[data-col-key="name"]')!;
      const scoreCell = el.shadowRoot!.querySelector<HTMLElement>('td[data-col-key="score"]')!;
      row.dispatchEvent(key(enterFirst));
      expect(el.shadowRoot!.activeElement === nameCell, `${direction}: ${enterFirst} enters the first editable cell`).to.equal(true);
      row.focus();
      row.dispatchEvent(key(enterLast));
      expect(el.shadowRoot!.activeElement === scoreCell, `${direction}: ${enterLast} enters the last editable cell`).to.equal(true);
    }
  });

  it('handles a keydown aimed at a non-editable cell as a keydown on its row', async () => {
    const el = await mount();
    el.columns = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      { key: 'score', label: 'Score', cell: (r) => r.score, editTrigger: 'double-click', editType: 'number', editValue: (r) => r.score },
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const plain = el.shadowRoot!.querySelector<HTMLElement>('td[data-col-key="name"]')!;
    const activation = oneEvent(el, 'lr-row-activate');
    plain.dispatchEvent(key('Enter'));
    expect((await activation).detail.row).to.deep.equal(rows[0]);
    expect(el.shadowRoot!.querySelectorAll('[part="cell-editor"]').length).to.equal(0);
  });
});
