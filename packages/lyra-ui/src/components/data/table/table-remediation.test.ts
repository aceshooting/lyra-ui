import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './table.js';
import type { LyraTable, TableColumn } from './table.js';

type Row = { id: string; name: string };
const rows: Row[] = [{ id: 'ä', name: 'ä' }, { id: 'z', name: 'z' }];
const columns: TableColumn<Row>[] = [{ key: 'name', label: 'Name', sortable: true, editTrigger: 'double-click', editValue: (row) => row.name, cell: (row) => row.name }];
const rowKey = (row: Row) => row.id;

describe('table live derived rows and responsive bands', () => {
  it('treats removed filter-text as absence and recovers without changing null readback', async () => {
    const element = await fixture<LyraTable<Row>>(html`<lr-table caption="Names" filter-text="ä" .rows=${rows} .columns=${columns} .rowKey=${rowKey}></lr-table>`);
    expect(element.shadowRoot!.querySelectorAll('tbody tr[data-row-key]').length).to.equal(1);
    element.removeAttribute('filter-text');
    await element.updateComplete;
    expect(element.filterText as unknown).to.equal(null);
    expect(element.shadowRoot!.querySelectorAll('tbody tr[data-row-key]').length).to.equal(2);
    element.setAttribute('filter-text', 'z');
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('tbody tr[data-row-key]')?.textContent).to.contain('z');
    element.setAttribute('filter-text', '');
    await element.updateComplete;
    expect(element.filterText).to.equal('');
    expect(element.shadowRoot!.querySelectorAll('tbody tr[data-row-key]').length).to.equal(2);
  });

  for (const inherited of [false, true]) {
    it(`refreshes activation and focused page identity after ${inherited ? 'inherited' : 'own'} locale recollation`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div lang="de"><lr-table caption="Names"
        .rows=${rows} .columns=${columns} .rowKey=${rowKey} sort-key="name" .pageSize=${1}
      ></lr-table></div>`);
      const element = wrapper.querySelector<LyraTable<Row>>('lr-table')!;
      if (!inherited) element.lang = 'de';
      await element.updateComplete;
      const displayed = () => element.shadowRoot!.querySelector<HTMLElement>('tbody tr[data-row-key]')!;
      expect(displayed().textContent).to.contain('ä');
      const activated: Row[] = [];
      element.addEventListener('lr-row-click', (event) => activated.push((event as CustomEvent<{ row: Row }>).detail.row));
      displayed().click();
      expect(activated[0] === rows[0]).to.equal(true);
      displayed().focus();
      (inherited ? wrapper : element).lang = 'sv';
      await waitUntil(() => displayed().textContent?.includes('z') === true);
      expect(activated.length).to.equal(1);
      expect(element.shadowRoot!.activeElement?.getAttribute('data-row-key')).to.equal(displayed().getAttribute('data-row-key'));
      await sendKeys({ press: 'Enter' });
      expect(activated[1] === rows[1]).to.equal(true);
      displayed().click();
      expect(activated[2] === rows[1]).to.equal(true);
      const cell = displayed().querySelector<HTMLElement>('[part="cell"]')!;
      cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
      await element.updateComplete;
      const editor = cell.querySelector<HTMLInputElement>('[part="cell-editor"]');
      expect(editor?.value).to.equal('z');
      const edits: Row[] = [];
      element.addEventListener('lr-cell-edit', (event) => edits.push((event as CustomEvent<{ row: Row }>).detail.row));
      editor!.value = 'Renamed';
      editor!.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      expect(edits[0] === rows[1]).to.equal(true);
    });
  }

  for (const direction of ['ltr', 'rtl']) {
    for (const width of [320, 700, 1000]) {
      it(`aligns footer priorities with header and body at ${width}px in ${direction}`, async () => {
        const priorityColumns: TableColumn<Row>[] = ['high', 'medium', 'low'].map((priority) => ({
          key: priority, label: priority, priority: priority === 'high' ? undefined : priority as 'medium' | 'low', cell: (row: Row) => row.name, footer: () => 'Total',
        }));
        const element = await fixture<LyraTable<Row>>(html`<lr-table caption="Names"
          style=${`inline-size: ${width}px`} dir=${direction} .rows=${rows} .columns=${priorityColumns}
          .rowKey=${rowKey} .expandedContent=${() => html`Details`}
        ></lr-table>`);
        await waitUntil(() => element.getBoundingClientRect().width === width);
        for (const priority of ['high', 'medium', 'low']) {
          const cells = [...element.shadowRoot!.querySelectorAll<HTMLElement>(`[data-col-key="${priority}"]`)].filter((cell) => cell.matches('th,td'));
          const expected = priority === 'low' && width < 900 || priority === 'medium' && width < 640 ? 'none' : 'table-cell';
          expect(cells.map((cell) => getComputedStyle(cell).display)).to.deep.equal(Array(cells.length).fill(expected));
          expect(cells.some((cell) => cell.getAttribute('part') === 'footer-cell')).to.equal(true);
        }
        expect([...element.shadowRoot!.querySelectorAll<HTMLElement>('tfoot td:not([data-col-key])')].map((cell) => getComputedStyle(cell).display)).to.deep.equal(['table-cell']);
        element.priorityColumnsVisible = true;
        await element.updateComplete;
        expect([...element.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key],td[data-col-key]')].every((cell) => getComputedStyle(cell).display === 'table-cell')).to.equal(true);
      });
    }
  }
});
