import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './spreadsheet-viewer.js';
import type { SpreadsheetViewerSource } from './spreadsheet-viewer.js';
import { MINIMAL_XLSX_BASE64 } from './fixtures/minimal-xlsx-fixture.js';

const meta: Meta = {
  title: 'DocumentViewer/SpreadsheetViewer',
  component: 'lr-spreadsheet-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Highlight actions localize their complete cell value and annotation through separate `{value}` and `{label}` placeholders, allowing locale-specific order and punctuation.' } } },
};
export default meta;
type Story = StoryObj;
const src = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${MINIMAL_XLSX_BASE64}`;
export const Default: Story = { render: () => html`<lr-spreadsheet-viewer src=${src} name="people.xlsx"></lr-spreadsheet-viewer>` };
export const Empty: Story = { render: () => html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>` };
export const FailedFetch: Story = { render: () => html`<lr-spreadsheet-viewer src="https://example.invalid/missing.xlsx" name="missing.xlsx"></lr-spreadsheet-viewer>` };

/** A narrow host (320px), matching the library's baseline narrow-allocation check -- confirms the
 *  grid header row and its `<lr-tab-group>`/virtualized body scroll horizontally instead of overflowing
 *  the allocation, matching lr-dataset-viewer's identical narrow-story precedent. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-spreadsheet-viewer src=${src} name="people.xlsx"></lr-spreadsheet-viewer></div>`,
};

export const InMemory: Story = {
  parameters: { docs: { description: { story: 'An owned scalar-cell snapshot bypasses fetch and parser loading. Set limits before assigning the input; clearing it restores src. Row, column, and byte limits can be raised to ten times their defaults, while the aggregate cell limit remains 1,000,000.' } } },
  render: () => html`<lr-spreadsheet-viewer .maxRows=${20000} .maxColumns=${2000} .maxBytes=${52428800} .workbook=${{ sheets: [{ name: 'People', rows: [['Name', 'Role'], ['Ada', 'Mathematician']] }] }} max-height="20rem"></lr-spreadsheet-viewer>`,
};


const indexedSource: SpreadsheetViewerSource = { revision: 1, sheets: [{ key: 'records', name: 'Records', data: { revision: 1, rowCount: 1_000_000, columnCount: 3,
  columnAt: (index: number) => ({ key: String(index), label: ['Record', 'Category', 'Value'][index]! }),
  cellAt: (row: number, column: number) => column === 0 ? row + 1 : column === 1 ? `Category ${row % 12}` : `Value ${row + 1}`,
} }] };
export const MillionRecords: Story = {
  parameters: { docs: { description: { story: 'The host supplies one million logical body records without constructing a row array. Separate column labels occupy display row one; the last body row is A1000001. Source rows use the live --lr-size-3rem token, with bounded overflowing display. Global search is available only when the source supplies search(). Assign undefined to restore the ordinary input or URL.' } } },
  render: () => html`<lr-spreadsheet-viewer .dataSource=${indexedSource} .anchor=${{ kind: 'cell-range', range: 'A1000001' } }></lr-spreadsheet-viewer>`,
};
