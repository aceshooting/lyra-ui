import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../components/data/data-grid/data-grid.js';
import '../components/data/table/table.js';
import type { LyraDataGrid } from '../components/data/data-grid/data-grid.js';
import type { LyraTable } from '../components/data/table/table.js';

it('keeps data-grid default row floors and pinned edge arithmetic valid when optional length inputs are absent', async () => {
  const host = await fixture<LyraDataGrid>(html`<lr-data-grid label="Rows" .columns=${[{ field: 'value', label: 'Value', pinned: 'right' }]} .data=${[{ value: 'One' }]}></lr-data-grid>`);
  await host.updateComplete;
  await waitUntil(() => Boolean(host.shadowRoot!.querySelector('[part="row"]')));
  const row = host.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
  const header = host.shadowRoot!.querySelector<HTMLElement>('[part="header-cell"]')!;
  const expected = 3.5 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  expect(Number.parseFloat(getComputedStyle(row).minBlockSize)).to.be.closeTo(expected, 0.05);
  expect(Number.parseFloat(getComputedStyle(header).minBlockSize)).to.be.closeTo(expected, 0.05);
  header.style.setProperty('--pin-offset', 'initial');
  header.style.setProperty('--data-grid-body-inline-end-gutter', '10px');
  expect(getComputedStyle(header).insetInlineEnd).to.equal('10px');
  header.style.setProperty('--pin-offset', '14px');
  header.style.setProperty('--data-grid-body-inline-end-gutter', 'initial');
  expect(getComputedStyle(header).insetInlineEnd).to.equal('14px');
});

it('keeps the table row height floor when the optional density minimum is absent', async () => {
  const host = await fixture<LyraTable<{ value: string }>>(html`<lr-table aria-label="Rows" .columns=${[{ key: 'value', label: 'Value', cell: (row: { value: string }) => row.value }]} .rows=${[{ value: 'One' }]}></lr-table>`);
  await host.updateComplete;
  const row = host.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
  host.style.setProperty('--lr-table-row-height', '80px');
  expect(row.getBoundingClientRect().height).to.be.closeTo(80, 0.05);
});
