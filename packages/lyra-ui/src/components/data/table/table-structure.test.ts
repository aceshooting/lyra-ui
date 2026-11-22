import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import '../../lr-table.js';
import type { LyraTable, TableColumn } from '../../lr-table.js';
import { installTableTestHooks, type Row, rows } from '../../../../test/table.js';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { isAllowedRowAttribute, normalizeRowAttributes, reservedCellPartNames, TABLE_PART_NAMES } from './table-support.js';
installTableTestHooks();

const headed: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', rowHeader: true, sortable: true, cell: (r) => r.name },
  { key: 'score', label: 'Score', align: 'end', cell: (r) => String(r.score) },
];

async function make(
  cols: TableColumn<Row>[],
  options: { attrs?: string; dir?: string; width?: string; setup?: (el: LyraTable<Row>) => void } = {}
): Promise<LyraTable<Row>> {
  const wrap = await fixture<HTMLElement>(html`<div dir=${options.dir ?? 'ltr'} style="inline-size: ${options.width ?? '640px'}"></div>`);
  wrap.innerHTML = `<lr-table ${options.attrs ?? 'aria-label="Accounts"'}></lr-table>`;
  const el = wrap.querySelector<LyraTable<Row>>('lr-table')!;
  el.columns = cols;
  el.rows = rows;
  el.rowKey = (r: Row) => r.id;
  el.selectionMode = 'single';
  options.setup?.(el);
  await el.updateComplete;
  return el;
}
const bodyRows = (el: LyraTable<Row>) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]'));

describe('lr-table rowHeader columns', () => {
  it('renders the column as th scope=row with the rowheader role, leaving others as gridcells', async () => {
    const el = await make(headed);
    const [first, second] = Array.from(bodyRows(el)[0]!.children) as HTMLElement[];
    expect(first!.localName).to.equal('th');
    expect(first!.getAttribute('scope')).to.equal('row');
    expect(first!.getAttribute('role')).to.equal('rowheader');
    expect(first!.getAttribute('part')).to.equal('cell');
    expect(first!.hasAttribute('data-row-header')).to.equal(true);
    expect(second!.localName).to.equal('td');
    expect(second!.getAttribute('role')).to.equal('gridcell');
    expect(second!.hasAttribute('scope')).to.equal(false);
    await expect(el).to.be.accessible();
  });

  it('looks like its row by default and takes --lr-table-row-header-font-weight', async () => {
    const el = await make(headed);
    const [th, td] = Array.from(bodyRows(el)[0]!.children) as HTMLElement[];
    expect(getComputedStyle(th!).fontWeight).to.equal(getComputedStyle(td!).fontWeight);
    expect(getComputedStyle(th!).textAlign).to.equal(getComputedStyle(td!.closest('tr')!).textAlign);
    el.style.setProperty('--lr-table-row-header-font-weight', '700');
    expect(getComputedStyle(th!).fontWeight).to.equal('700');
  });

  it('keeps header sorting, row activation and selection apart from the body th', async () => {
    const el = await make(headed);
    let sorts = 0;
    el.addEventListener('lr-sort', () => sorts++);
    const selected = oneEvent(el, 'lr-selection-change');
    (bodyRows(el)[1]!.children[0] as HTMLElement).click();
    expect([...(await selected).detail.selectedRowKeys]).to.deep.equal(['b']);
    expect(sorts, 'a row-header click never sorts').to.equal(0);
    const sorted = oneEvent(el, 'lr-sort');
    el.shadowRoot!.querySelector<HTMLElement>('[part="header-cell"][data-col-key="name"]')!.click();
    expect((await sorted).detail.sortKey).to.equal('name');
  });

  it('moves the header roving focus only across column headers', async () => {
    const el = await make(headed);
    const name = el.shadowRoot!.querySelector<HTMLElement>('[part="header-cell"][data-col-key="name"]')!;
    await focusByKeyboard(name);
    await sendKeys({ press: 'End' });
    const active = el.shadowRoot!.activeElement as HTMLElement;
    expect(active.getAttribute('part')).to.equal('header-cell');
    expect(active.dataset['colKey']).to.equal('score');
  });

  it('stays accessible stacked, under RTL and at 320px', async () => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    try {
      await setViewport({ width: 320, height: 640 });
      for (const dir of ['ltr', 'rtl']) {
        const el = await make(headed, { attrs: 'aria-label="Accounts" stack="always"', dir, width: 'auto' });
        expect(el.shadowRoot!.querySelector('th[scope="row"] [part="cell-label"]')?.textContent).to.equal('Name');
        expect(document.documentElement.scrollWidth, `${dir}: no page overflow`).to.be.at.most(window.innerWidth);
        await expect(el).to.be.accessible();
      }
    } finally {
      await setViewport(viewport);
    }
  });

  it('is an ordinary td when unset (regression)', async () => {
    const el = await make(headed.map(({ rowHeader: _r, ...col }) => col as TableColumn<Row>));
    expect(el.shadowRoot!.querySelector('tbody th') === null).to.equal(true);
  });
});

describe('lr-table without-header-row', () => {
  it('omits the thead and stays named by its caption, attribute and property alike', async () => {
    const el = await make(headed, { attrs: 'caption="Account summary" without-header-row' });
    expect(el.withoutHeaderRow).to.equal(true);
    expect(el.shadowRoot!.querySelector('thead') === null).to.equal(true);
    const table = el.shadowRoot!.querySelector('[part="table"]')!;
    expect(table.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('[part="caption"]')!.id);
    expect(bodyRows(el).length).to.equal(2);
    await expect(el).to.be.accessible();
    el.withoutHeaderRow = false;
    await el.updateComplete;
    expect(el.hasAttribute('without-header-row')).to.equal(false);
    expect(el.shadowRoot!.querySelector('thead') !== null).to.equal(true);
  });

  it('keeps rows keyboard reachable and selectable', async () => {
    const el = await make(headed, { attrs: 'aria-label="Accounts" without-header-row' });
    const [first, second] = bodyRows(el);
    await focusByKeyboard(first!);
    await sendKeys({ press: 'ArrowDown' });
    expect(el.shadowRoot!.activeElement === second).to.equal(true);
    const selected = oneEvent(el, 'lr-selection-change');
    await sendKeys({ press: 'Enter' });
    expect([...(await selected).detail.selectedRowKeys]).to.deep.equal(['b']);
  });

  it('stays accessible stacked, under RTL and at 320px', async () => {
    for (const dir of ['ltr', 'rtl']) {
      const el = await make(headed, { attrs: 'aria-label="Accounts" without-header-row stack="always"', dir, width: '320px' });
      expect(el.shadowRoot!.querySelector('thead') === null).to.equal(true);
      expect(el.parentElement!.scrollWidth, `${dir}: no overflow`).to.be.at.most(el.parentElement!.clientWidth + 1);
      await expect(el).to.be.accessible();
    }
  });

  it('keeps sticky offsets measured from the body when there is no header', async () => {
    const cols: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', sticky: 'start', width: '120px', cell: (r) => r.name },
      { key: 'id', label: 'Id', sticky: 'start', width: '80px', cell: (r) => r.id },
      { key: 'score', label: 'Score', width: '900px', cell: (r) => String(r.score) },
    ];
    const el = await make(cols, { attrs: 'aria-label="Accounts" without-header-row', width: '400px' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const id = el.shadowRoot!.querySelector<HTMLElement>('td[data-col-key="id"]')!;
    const name = el.shadowRoot!.querySelector<HTMLElement>('td[data-col-key="name"]')!;
    expect(parseFloat(id.style.getPropertyValue('--lr-table-sticky-offset'))).to.be.closeTo(name.offsetWidth, 1);
  });

  it('renders the thead when unset (regression)', async () => {
    const el = await make(headed);
    expect(el.withoutHeaderRow).to.equal(false);
    expect(el.shadowRoot!.querySelector('thead [part="header-cell"]') !== null).to.equal(true);
  });
});

describe('lr-table rowAttributes', () => {
  it('writes allowed data-* and aria attributes per row with the rendered index', async () => {
    const calls: number[] = [];
    const el = await make(headed, {
      setup: (table) => {
        table.rowAttributes = (row, index) => {
          calls.push(index);
          return { 'data-status': row.score > 2 ? 'ok' : 'low', 'data-flag': row.id === 'a', 'aria-rowindex': index + 2 };
        };
      },
    });
    const [first, second] = bodyRows(el);
    expect(first!.getAttribute('data-status')).to.equal('ok');
    expect(first!.getAttribute('data-flag')).to.equal('');
    expect(first!.getAttribute('aria-rowindex')).to.equal('2');
    expect(second!.getAttribute('data-status')).to.equal('low');
    expect(second!.hasAttribute('data-flag')).to.equal(false);
    expect(calls.slice(0, 2)).to.deep.equal([0, 1]);
    expect(first!.getAttribute('data-row-key')).to.not.equal(null);
    await expect(el).to.be.accessible();
  });

  it('refuses handlers, style and the table-owned markers, with a development warning', async () => {
    const messages = await captureDevWarnings(async () => {
      const el = await make(headed, {
        setup: (table) => {
          table.rowAttributes = () => ({
            onclick: 'alert(1)',
            style: 'color: red',
            class: 'x',
            role: 'button',
            tabindex: '0',
            'data-row-key': 'forged',
            'data-lr-theme-scope': '',
            'Data-Upper': 'x',
            'data-ok': 'yes',
          });
        },
      });
      const row = bodyRows(el)[0]!;
      for (const name of ['onclick', 'style', 'class', 'data-lr-theme-scope']) expect(row.hasAttribute(name), name).to.equal(false);
      expect(row.getAttribute('role')).to.equal('row');
      expect(row.getAttribute('data-row-key')).to.not.equal('forged');
      expect(row.getAttribute('data-ok')).to.equal('yes');
    });
    expect(messages.filter((m) => m.includes('rowAttributes')).length).to.equal(1);
  });

  it('removes a name the next render no longer returns, and survives a throwing callback', async () => {
    let on = true;
    const el = await make(headed, { setup: (table) => (table.rowAttributes = () => (on ? { 'data-mark': 'x' } : {})) });
    expect(bodyRows(el)[0]!.getAttribute('data-mark')).to.equal('x');
    on = false;
    el.rows = [...rows];
    await el.updateComplete;
    expect(bodyRows(el)[0]!.hasAttribute('data-mark')).to.equal(false);
    el.rowAttributes = () => {
      throw new Error('boom');
    };
    await el.updateComplete;
    expect(bodyRows(el).length).to.equal(2);
  });

  it('validates names and values as a pure function', () => {
    expect(isAllowedRowAttribute('data-x')).to.equal(true);
    expect(isAllowedRowAttribute('aria-label')).to.equal(true);
    expect(isAllowedRowAttribute('aria-selected')).to.equal(false);
    expect(isAllowedRowAttribute('onmouseover')).to.equal(false);
    expect(isAllowedRowAttribute('data-')).to.equal(false);
    expect(isAllowedRowAttribute('data-stripe')).to.equal(false);
    const { attributes, rejected } = normalizeRowAttributes({ 'data-a': 1, 'data-b': Number.NaN, 'data-c': null, 'data-d': {} });
    expect([...attributes]).to.deep.equal([['data-a', '1']]);
    expect(rejected).to.equal(true);
    expect(normalizeRowAttributes(undefined).rejected).to.equal(false);
    expect(normalizeRowAttributes('data-x').rejected).to.equal(true);
  });

  it('writes nothing extra when unset (regression)', async () => {
    const el = await make(headed);
    const names = bodyRows(el)[0]!.getAttributeNames().sort();
    expect(names).to.deep.equal(['aria-selected', 'data-row-key', 'data-stripe', 'part', 'role', 'tabindex']);
  });
});

describe('lr-table reserved part names', () => {
  it('warns once per cellPart name that collides with a table part, still applying it', async () => {
    const messages = await captureDevWarnings(async () => {
      const el = await make([
        { key: 'name', label: 'Name', cell: (r) => r.name, cellPart: () => 'cell-label cell-muted' },
        { key: 'score', label: 'Score', cell: (r) => String(r.score), cellPart: () => 'cell-label' },
      ]);
      const content = el.shadowRoot!.querySelector('[part~="cell-content"]')!;
      expect(content.getAttribute('part')).to.equal('cell-content cell-label cell-muted');
    });
    const collisions = messages.filter((m) => m.includes('cellPart'));
    expect(collisions.length).to.equal(1);
    expect(collisions[0]).to.contain('"cell-label"');
  });

  it('stays silent for prefixed names', async () => {
    const messages = await captureDevWarnings(() =>
      make([{ key: 'name', label: 'Name', cell: (r) => r.name, cellPart: () => 'cell-archived' }])
    );
    expect(messages.filter((m) => m.includes('cellPart'))).to.deep.equal([]);
  });

  it('lists every part the table renders', async () => {
    expect(reservedCellPartNames('cell-label row cell-ok')).to.deep.equal(['cell-label', 'row']);
    const el = await make(headed, { attrs: 'aria-label="Accounts" caption="Caption" stack="always" filterable' });
    for (const node of el.shadowRoot!.querySelectorAll('[part]')) {
      for (const name of node.getAttribute('part')!.split(/\s+/)) expect(TABLE_PART_NAMES, name).to.include(name);
    }
  });
});
