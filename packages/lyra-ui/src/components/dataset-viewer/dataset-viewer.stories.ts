import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './dataset-viewer.js';

const meta: Meta = { title: 'DocumentViewer/DatasetViewer', component: 'lyra-dataset-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = 'name\tstatus\nAda\tActive\nGrace\tActive';
const src = `data:text/tab-separated-values,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lyra-dataset-viewer src=${src} name="People"></lyra-dataset-viewer>` };
export const Empty: Story = { render: () => html`<lyra-dataset-viewer></lyra-dataset-viewer>` };
