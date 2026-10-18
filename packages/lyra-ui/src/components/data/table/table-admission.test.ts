import { expect, fixture, html } from '@open-wc/testing';
import './table.js';
import type { LyraTable } from './table.js';
import { installTableTestHooks } from '../../../../test/table.js';
installTableTestHooks();

it('raises row and controlled-key admission together within a hard bound', async () => {
  const el = await fixture<LyraTable<number>>(html`<lr-table caption="Rows"></lr-table>`);
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.maxRows = 20_000;
  el.rows = Array.from({ length: 10_001 }, (_, i) => i);
  el.selectedRowKeys = new Set(el.rows);
  await el.updateComplete;
  expect(el.rows.length).to.equal(10_001);
  expect(el.selectedRowKeys.size).to.equal(10_001);
  expect(el.rowsTruncated).to.equal(false);
  el.maxRows = 1_000_000;
  expect(el.maxRows).to.equal(100_000);
  el.maxRows = NaN;
  expect(el.maxRows).to.equal(10_000);
  await el.updateComplete;
  expect(el.rows.length).to.equal(10_000);
  expect(el.rowsTruncated).to.equal(true);
});

it('preserves the default 10000-row admission and localized disclosure when unset', async () => {
  const el = await fixture<LyraTable<number>>(html`<lr-table caption="Rows"></lr-table>`);
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.rows = Array.from({ length: 10_001 }, (_, i) => i);
  await el.updateComplete;
  expect(el.rows.length).to.equal(10_000);
  expect(el.rowsTruncated).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="row-limit"]')?.textContent).to.contain('10,000');
});

it('announces a newly truncated row assignment using the localized cap notice', async () => {
  const el = await fixture<LyraTable<number>>(html`<lr-table caption="Rows"></lr-table>`);
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.strings = { tableRowLimit: 'Retained {count}' };
  await el.updateComplete;
  const messages: string[] = [];
  const seam = el as unknown as { announcements: { announcePolite(text: string): void } };
  const original = seam.announcements.announcePolite;
  seam.announcements.announcePolite = text => { messages.push(text); };
  try {
    el.maxRows = 2;
    el.rows = [1, 2, 3];
    await el.updateComplete;
    expect(messages).to.deep.equal(['Retained 2']);
  } finally { seam.announcements.announcePolite = original; }
});

it('allows the prior controlled selection to be rebound after an internal toggle', async () => {
  const el = await fixture<LyraTable<number>>(html`<lr-table caption="Rows" selection-mode="multiple"></lr-table>`);
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.rows = [1, 2];
  const controlled = new Set<number>();
  el.selectedRowKeys = controlled;
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLElement>('tbody tr')!.click();
  await el.updateComplete;
  expect(el.selectedRowKeys.size).to.equal(1);
  el.selectedRowKeys = controlled;
  await el.updateComplete;
  expect(el.selectedRowKeys.size).to.equal(0);
});

it('keeps admission loss disclosed when the original weak source is no longer available', async () => {
  const el = await fixture<LyraTable<number>>(html`<lr-table caption="Rows"></lr-table>`);
  el.columns = [{ key: 'value', label: 'Value', cell: row => row }];
  el.rows = Array.from({ length: 10_001 }, (_, i) => i);
  await el.updateComplete;
  (el as unknown as { rowSource: { deref(): undefined } }).rowSource = { deref: () => undefined };
  el.maxRows = 20_000;
  await el.updateComplete;
  expect(el.rowsTruncated).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="row-limit"]')?.textContent).to.contain('10,000');
  el.rows = Array.from({ length: 10_001 }, (_, i) => i);
  await el.updateComplete;
  expect(el.rows.length).to.equal(10_001);
  expect(el.rowsTruncated).to.equal(false);
});
