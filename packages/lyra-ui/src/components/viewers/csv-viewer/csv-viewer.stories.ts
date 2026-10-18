import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './csv-viewer.js';
import type { CsvViewerSource } from './csv-viewer.js';

const meta: Meta = {
  title: 'DocumentViewer/CsvViewer',
  component: 'lr-csv-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'A host `aria-label` names both the CSV region and loaded table by attribute presence, including an explicitly empty value; `name` and the localized label are fallbacks. The persistent header stays above the nested virtual-list row scrollport. Highlight actions localize their complete cell value and annotation through separate `{value}` and `{label}` placeholders. Quote-aware row, column, aggregate-cell, and diagnostic ceilings are enforced before PapaParse materializes the grid.' } } },
};
export default meta;
type Story = StoryObj;
const sample = `Name,Role,Notes\nAda Lovelace,Mathematician,"Wrote notes on the ""Analytical Engine"", 1843"\nGrace Hopper,Computer scientist,"Found a literal moth"`;
const src = `data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`;
export const QuotedFields: Story = { render: () => html`<lr-csv-viewer src=${src} name="scientists.csv"></lr-csv-viewer>` };
export const NoHeaderRow: Story = { render: () => html`<lr-csv-viewer src=${src} name="scientists.csv" without-header-row></lr-csv-viewer>` };
export const SingleColumn: Story = {
  render: () => html`<lr-csv-viewer
    src=${`data:text/csv,${encodeURIComponent('Name\nAda\nGrace')}`}
    name="names.csv"
  ></lr-csv-viewer>`,
};
export const Empty: Story = { render: () => html`<lr-csv-viewer></lr-csv-viewer>` };

/** Baseline narrow-allocation coverage with long cell content and horizontal scrolling. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-csv-viewer src=${src} name="scientists-with-long-notes.csv"></lr-csv-viewer></div>`,
};

export const InMemory: Story = {
  parameters: { docs: { description: { story: 'An owned scalar-cell snapshot bypasses fetch and parser loading. Set limits before assigning the input; clearing it restores src. Row, column, and byte limits can be raised to ten times their defaults, while the aggregate cell limit remains 1,000,000.' } } },
  render: () => html`<lr-csv-viewer .maxRows=${20000} .maxColumns=${2000} .maxBytes=${52428800} .rows=${[['Name', 'Role'], ['Ada', 'Mathematician'], ['Grace', 'Computer scientist']]} max-height="20rem"></lr-csv-viewer>`,
};


const indexedSource: CsvViewerSource = { revision: 1, rowCount: 1_000_000, columnCount: 3,
  columnAt: (index: number) => ({ key: String(index), label: ['Record', 'Category', 'Value'][index]! }),
  cellAt: (row: number, column: number) => column === 0 ? row + 1 : column === 1 ? `Category ${row % 12}` : `Value ${row + 1}`,
};
export const MillionRecords: Story = {
  parameters: { docs: { description: { story: 'The host supplies one million logical body records without constructing a row array. Separate column labels occupy display row one; the last body row is A1000001. Source rows use the live --lr-size-3rem token, with bounded overflowing display. Global search is available only when the source supplies search(). Assign undefined to restore the ordinary input or URL.' } } },
  render: () => html`<lr-csv-viewer .dataSource=${indexedSource} .anchor=${{ kind: 'cell-range', range: 'A1000001' } }></lr-csv-viewer>`,
};
