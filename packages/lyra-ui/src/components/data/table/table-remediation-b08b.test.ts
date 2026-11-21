import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resolvedColorToken } from '../../../../test/color-contrast.js';
import '../../lr-table.js';
import type { LyraTable } from '../../lr-table.js';
import { installTableTestHooks, type Row, columns, editableColumns, rows } from '../../../../test/table.js';
installTableTestHooks();

describe('table clipped focus rings', () => {
  it('draws header and row focus rings inside the scrolling base', async () => {
    const el = (await fixture(html`<lr-table selection-mode="single" style="--lr-focus-ring-offset: 3px"></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rowKey = (r) => r.id;
    el.rows = rows;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header-cell"]')!;
    await focusByKeyboard(header);
    expect(parseFloat(getComputedStyle(header).outlineOffset)).to.be.at.most(0);
    const row = el.shadowRoot!.querySelector<HTMLElement>('[data-row-key]')!;
    await focusByKeyboard(row);
    expect(parseFloat(getComputedStyle(row).outlineOffset)).to.be.at.most(0);
  });

  it('names the resize separator from the column key when the label is blank', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ ...columns[0]!, key: 'owner', label: '  ', resizable: true }];
    el.rowKey = (r) => r.id;
    el.rows = rows;
    await el.updateComplete;
    const separator = el.shadowRoot!.querySelector<HTMLElement>('[role="separator"]')!;
    expect(separator.getAttribute('aria-label')).to.contain('owner');
  });
});

it('includes the row key in the default expand and collapse names', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table expansion-mode="multiple" .rows=${rows}
    .columns=${columns} .rowKey=${(r: Row) => r.id} .expandedContent=${(r: Row) => html`${r.id}`}></lr-table>`);
  const buttons = [...table.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="row-expand-toggle"]')];
  expect(buttons.length).to.equal(rows.length);
  buttons[0]!.click();
  await table.updateComplete;
  for (const [index, button] of buttons.entries()) {
    expect(button.getAttribute('aria-label')).to.contain(String(rows[index]!.id));
  }
});

it('lets the table owner veto a page request before the client page changes', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table page-size="1" .rows=${rows}
    .columns=${columns} .rowKey=${(r: Row) => r.id}></lr-table>`);
  table.addEventListener('lr-before-page-change', event => event.preventDefault());
  table.shadowRoot!.querySelector('lr-pagination')!.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!.click();
  expect(table.page).to.equal(1);
});

it('matches unaccented filter text and announces the filtered row count', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table filterable .columns=${columns}
    .rows=${[{ ...rows[0], name: 'Café' }]} .rowKey=${(r: Row) => r.id}
    .strings=${{ viewerSearchMatchCount: { one: 'One matching row', other: '{count} matches' } }}></lr-table>`);
  const field = table.shadowRoot!.querySelector<HTMLInputElement>('input[type="search"]')!;
  field.value = 'cafe';
  field.dispatchEvent(new Event('input'));
  await table.updateComplete;
  expect(table.shadowRoot!.querySelectorAll('[data-row-key]').length).to.equal(1);
  await waitUntil(() => sinkTexts().includes('One matching row'), 'filtered row count');
});

it('keeps the authored horizontal padding on resizable headers and lets a flex item shrink', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table style="--lr-table-cell-padding: 2px 41px"
    .columns=${[{ ...columns[0]!, resizable: true }]} .rows=${rows}></lr-table>`);
  const header = table.shadowRoot!.querySelector<HTMLElement>('[data-resizable]')!;
  expect(getComputedStyle(header).paddingInlineEnd).to.equal('41px');
  expect(getComputedStyle(table).minInlineSize).to.equal('0px');
});

it('honors row and header hover colors and their interactive transitions', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table style="--lr-table-row-hover-bg: rgb(2, 12, 22);
    --lr-table-sortable-header-hover-bg: rgb(3, 13, 23); --lr-transition-interactive: background-color 0.02s linear"
    .columns=${columns} .rows=${rows}></lr-table>`);
  try {
    for (const [selector, color] of [['[part="row"]', 'rgb(2, 12, 22)'], ['[data-sortable]', 'rgb(3, 13, 23)']] as const) {
      const target = table.shadowRoot!.querySelector<HTMLElement>(selector)!;
      await hoverUntilMatched(target, 'table hover');
      await waitUntil(() => getComputedStyle(target).backgroundColor === color, 'themed surface');
      expect(getComputedStyle(target).transitionDuration).to.contain('0.02s');
    }
  } finally { await resetMouse(); }
});

it('keeps unfilled row, editable-cell and load-more text in step with a theme change', async () => {
  const scope = await fixture<HTMLElement>(html`<div data-lr-mode="light"><lr-table has-more .rows=${rows}
    .columns=${[editableColumns[0]!, columns[1]!]}></lr-table></div>`);
  const table = scope.querySelector<LyraTable<Row>>('lr-table')!;
  await table.updateComplete;
  const root = table.shadowRoot!;
  const row = root.querySelector<HTMLElement>('[data-row-key]')!;
  const editable = row.querySelector<HTMLElement>('[data-editable]')!;
  const plain = row.querySelector<HTMLElement>('[part="cell"]:not([data-editable])')!;
  const more = root.querySelector<HTMLElement>('[part="more-button"]')!;
  const light = getComputedStyle(table).color;
  scope.setAttribute('data-lr-mode', 'dark');
  const text = getComputedStyle(table).color;
  expect(text).to.not.equal(light);
  for (const [name, part] of [['row', row], ['editable cell', editable], ['cell', plain]] as const) {
    expect(getComputedStyle(part).color, name).to.equal(text);
  }
  expect(getComputedStyle(more).color).to.equal(resolvedColorToken(root, '--lr-color-brand'));
});

it('pages through available rows from a header and skips unavailable editable cells', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table .rows=${rows} .columns=${columns.map(column => ({ ...column, editTrigger: 'double-click' }))}></lr-table>`);
  const root = table.shadowRoot!;
  const send = (target: HTMLElement, key: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const header = root.querySelector<HTMLElement>('[data-col-key][part="header-cell"]')!;
  const bodyRows = [...root.querySelectorAll<HTMLElement>('[data-row-key]')];
  await focusByKeyboard(header);
  send(header, 'PageUp');
  expect(root.activeElement === bodyRows[0]).to.equal(true);
  send(bodyRows[0]!, 'PageDown');
  expect(root.activeElement === bodyRows.at(-1)).to.equal(true);
  await focusByKeyboard(header);
  send(header, 'PageDown');
  expect(root.activeElement === bodyRows.at(-1)).to.equal(true);
  send(bodyRows.at(-1)!, 'PageUp');
  expect(root.activeElement === bodyRows[0]).to.equal(true);
  const cells = bodyRows[0]!.querySelectorAll<HTMLElement>('[data-editable]');
  cells[0]!.setAttribute('aria-disabled', 'true');
  send(bodyRows[0]!, 'ArrowRight');
  expect(root.activeElement === cells[1]).to.equal(true);
});

it('keeps keyboard row navigation available without selector escaping', async () => {
  const table = await fixture<LyraTable<Row>>(html`<lr-table .rows=${rows} .columns=${columns}
    .rowKey=${(row: Row) => '["' + row.id}></lr-table>`);
  const root = table.shadowRoot!;
  const header = root.querySelector<HTMLElement>('[part="header-cell"]')!;
  const bodyRows = [...root.querySelectorAll<HTMLElement>('[data-row-key]')];
  await focusByKeyboard(header);
  const prior = Object.getOwnPropertyDescriptor(CSS, 'escape')!;
  try {
    Object.defineProperty(CSS, 'escape', { ...prior, value: undefined });
    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    expect(root.activeElement === bodyRows.at(-1)).to.equal(true);
    for (const row of bodyRows) row.inert = true;
    await focusByKeyboard(header);
    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    expect(root.activeElement === header).to.equal(true);
  } finally {
    Object.defineProperty(CSS, 'escape', prior);
  }
});
