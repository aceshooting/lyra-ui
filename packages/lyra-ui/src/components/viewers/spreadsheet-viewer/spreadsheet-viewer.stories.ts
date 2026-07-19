import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './spreadsheet-viewer.js';

const meta: Meta = { title: 'DocumentViewer/SpreadsheetViewer', component: 'lr-spreadsheet-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Empty: Story = { render: () => html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>` };
export const FailedFetch: Story = { render: () => html`<lr-spreadsheet-viewer src="https://example.invalid/missing.xlsx" name="missing.xlsx"></lr-spreadsheet-viewer>` };
