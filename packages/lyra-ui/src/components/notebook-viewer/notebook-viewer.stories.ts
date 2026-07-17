import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './notebook-viewer.js';

const meta: Meta = { title: 'DocumentViewer/NotebookViewer', component: 'lyra-notebook-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const NOTEBOOK = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { language_info: { name: 'python' } },
  cells: [
    { cell_type: 'markdown', id: 'md1', source: ['# Agent trace\n', 'A short analysis notebook.'], metadata: {} },
    {
      cell_type: 'code',
      id: 'code1',
      source: 'import pandas as pd\ndf.describe()',
      execution_count: 1,
      metadata: {},
      outputs: [{ output_type: 'stream', name: 'stdout', text: 'count  10\nmean   4.2\n' }],
    },
  ],
};

export const Default: Story = {
  render: () => html`<lyra-notebook-viewer name="analysis.ipynb" .notebook=${NOTEBOOK}></lyra-notebook-viewer>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px"><lyra-notebook-viewer name="analysis.ipynb" .notebook=${NOTEBOOK}></lyra-notebook-viewer></div>`,
};
