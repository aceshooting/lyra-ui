import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './data-grid.js';
import type { DataGridColumn, LyraDataGrid } from './data-grid.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

type Row = { id: string; rank?: number; children?: Row[] };
const rows: Row[] = [{ id: 'two', rank: 2 }, { id: 'missing' }, { id: 'one', rank: 1 }];

for (const direction of ['ltr', 'rtl'] as const) {
  it(`retains logical alignment, pinning and missing-value sorting through column normalization in ${direction}`, async () => {
    const columns: DataGridColumn<Row>[] = [{ field: 'rank', label: 'Rank', align: 'end', pinned: 'start', sortFn: 'basic', sortUndefined: 'first', filterType: 'number-range', filterable: true }];
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid dir=${direction} row-key="id" .columns=${columns} .data=${rows}></lr-data-grid>`);
    const header = element.shadowRoot!.querySelector<HTMLElement>('[data-column-id="rank"][role="columnheader"]')!;
    expect(header.dataset['align']).to.equal('end');
    expect(header.dataset['pin']).to.equal('left');
    await focusByKeyboard(header);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => header.getAttribute('aria-sort') === 'ascending');
    expect(element.getProcessedRows().map(row => row.id)).to.deep.equal(['missing', 'one', 'two']);
    expect(element.columns[0]?.filterType).to.equal('number-range');
    expect(element.columns[0]?.sortFn).to.equal('basic');
    element.filters = [{ id: 'rank', value: [1.5, 2.5] }];
    await element.updateComplete;
    expect(element.getProcessedRows().map(row => row.id)).to.deep.equal(['two']);
  });
}

it('selects nested grandchildren from a collapsed parent through its native checkbox and retains frozen event identities', async () => {
  const grandchild: Row = { id: 'grandchild', rank: 3 };
  const child: Row = { id: 'child', rank: 2, children: [grandchild] };
  const root: Row = { id: 'root', rank: 1, children: [child] };
  const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid row-key="id" child-rows="children" selectable="multiple" .columns=${[{ field: 'rank', label: 'Rank' }]} .data=${[root]}></lr-data-grid>`);
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.equal(1);
  const pending = oneEvent(element, 'lr-row-select');
  element.shadowRoot!.querySelector<HTMLInputElement>('[part~="row"] input[type="checkbox"]')!.click();
  const event = await pending;
  expect(element.selectedKeys).to.deep.equal(['root', 'child', 'grandchild']);
  expect(event.detail.selectedRows.map((row: Row) => row.id)).to.deep.equal(['root', 'child', 'grandchild']);
  expect(event.detail.selectedRows[2] === grandchild).to.equal(true);
  expect(Object.isFrozen(event.detail.selectedRows)).to.equal(true);
});

it('moves partially clipped virtual rows into view with the default nearest alignment', async () => {
  const data = Array.from({ length: 100 }, (_, index) => ({ id: String(index), rank: index }));
  const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid style="--lr-data-grid-max-height: 180px; --lr-data-grid-row-height: 40px" row-key="id" .columns=${[{ field: 'rank', label: 'Rank' }]} .data=${data}></lr-data-grid>`);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  await waitUntil(() => body.scrollHeight > body.clientHeight);
  element.scrollToIndex(40, { align: 'start' });
  await waitUntil(() => element.shadowRoot!.querySelector('[part~="row"][data-visible-index="40"]') !== null);
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="40"]')!;
  body.scrollTop += 8;
  body.dispatchEvent(new Event('scroll'));
  await element.updateComplete;
  expect(row.getBoundingClientRect().top).to.be.lessThan(body.getBoundingClientRect().top);
  element.scrollToIndex(40);
  await waitUntil(() => row.getBoundingClientRect().top >= body.getBoundingClientRect().top - 1);
  expect(row.getBoundingClientRect().bottom).to.be.at.most(body.getBoundingClientRect().bottom + 1);
});

it('contains revoked column definitions and recovers with a later valid column', async () => {
  const revokedColumns = Proxy.revocable([{ field: 'rank', label: 'Rank' }], {});
  revokedColumns.revoke();
  const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid row-key="id" .data=${rows}></lr-data-grid>`);
  element.columns = revokedColumns.proxy;
  await element.updateComplete;
  expect(element.columns.length).to.equal(0);
  const revokedColumn = Proxy.revocable({ field: 'rank', label: 'Rejected' }, {});
  revokedColumn.revoke();
  element.columns = [revokedColumn.proxy, { field: 'rank', label: 'Usable rank', pinned: 'end', align: 'center', sortUndefined: 'last' }];
  await element.updateComplete;
  const header = element.shadowRoot!.querySelector<HTMLElement>('[data-column-id="rank"][role="columnheader"]')!;
  expect(element.columns.length).to.equal(1);
  expect(header.textContent).to.contain('Usable rank');
  expect(header.dataset['pin']).to.equal('right');
  expect(header.dataset['align']).to.equal('center');
  header.click();
  await element.updateComplete;
  expect(element.getProcessedRows().map(row => row.id)).to.deep.equal(['one', 'two', 'missing']);
});
