import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './csv-viewer.js';

const meta: Meta = { title: 'DocumentViewer/CsvViewer', component: 'lyra-csv-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;
const sample = `Name,Role,Notes\nAda Lovelace,Mathematician,"Wrote notes on the ""Analytical Engine"", 1843"\nGrace Hopper,Computer scientist,"Found a literal moth"`;
const src = `data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`;
export const QuotedFields: Story = { render: () => html`<lyra-csv-viewer src=${src} name="scientists.csv"></lyra-csv-viewer>` };
export const NoHeaderRow: Story = { render: () => html`<lyra-csv-viewer src=${src} name="scientists.csv" .hasHeaderRow=${false}></lyra-csv-viewer>` };
export const Empty: Story = { render: () => html`<lyra-csv-viewer></lyra-csv-viewer>` };
