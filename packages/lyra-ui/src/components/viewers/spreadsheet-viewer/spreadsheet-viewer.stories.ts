import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './spreadsheet-viewer.js';
import { MINIMAL_XLSX_BASE64 } from './fixtures/minimal-xlsx-fixture.js';

const meta: Meta = { title: 'DocumentViewer/SpreadsheetViewer', component: 'lr-spreadsheet-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
const src = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${MINIMAL_XLSX_BASE64}`;
export const Default: Story = { render: () => html`<lr-spreadsheet-viewer src=${src} name="people.xlsx"></lr-spreadsheet-viewer>` };
export const Empty: Story = { render: () => html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>` };
export const FailedFetch: Story = { render: () => html`<lr-spreadsheet-viewer src="https://example.invalid/missing.xlsx" name="missing.xlsx"></lr-spreadsheet-viewer>` };

/** A narrow host (320px), matching the library's baseline narrow-allocation check -- confirms the
 *  grid header row and its `<lr-tabs>`/virtualized body scroll horizontally instead of overflowing
 *  the allocation, matching lr-dataset-viewer's identical narrow-story precedent. */
export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-spreadsheet-viewer src=${src} name="people.xlsx"></lr-spreadsheet-viewer></div>`,
};
