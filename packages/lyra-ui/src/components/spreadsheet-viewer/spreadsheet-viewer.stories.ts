import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './spreadsheet-viewer.js';

const meta: Meta = { title: 'DocumentViewer/SpreadsheetViewer', component: 'lyra-spreadsheet-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
export const Empty: Story = { render: () => html`<lyra-spreadsheet-viewer></lyra-spreadsheet-viewer>` };
export const FailedFetch: Story = { render: () => html`<lyra-spreadsheet-viewer src="https://example.invalid/missing.xlsx" name="missing.xlsx"></lyra-spreadsheet-viewer>` };
