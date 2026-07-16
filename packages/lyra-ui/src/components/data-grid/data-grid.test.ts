import { fixture, expect, html } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid, DataGridColumn } from './data-grid.js';

it('renders rows and exposes grid semantics', async () => {
  const columns: DataGridColumn[] = [{ key: 'name', label: 'Name', sortable: true }, { key: 'count', label: 'Count' }];
  const el = (await fixture(html`<lyra-data-grid .columns=${columns} .rows=${[{ name: 'Alpha', count: 2 }]} aria-label="Results"></lyra-data-grid>`)) as LyraDataGrid;
  expect(el.shadowRoot!.querySelector('[role="grid"]')!.getAttribute('aria-label')).to.equal('Results');
  expect(el.shadowRoot!.querySelectorAll('[role="gridcell"]')).to.have.length(2);
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-data-grid aria-label="Results"></lyra-data-grid>`);
  await expect(el).to.be.accessible();
});
