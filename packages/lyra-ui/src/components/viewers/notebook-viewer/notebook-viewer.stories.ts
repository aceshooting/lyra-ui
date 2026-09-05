import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './notebook-viewer.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = { title: 'DocumentViewer/NotebookViewer', component: 'lr-notebook-viewer', tags: ['autodocs'] };
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
  render: () => html`<lr-notebook-viewer name="analysis.ipynb" .notebook=${NOTEBOOK}></lr-notebook-viewer>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-inline-size:320px"><lr-notebook-viewer name="analysis.ipynb" .notebook=${NOTEBOOK}></lr-notebook-viewer></div>`,
};

export const ThemedActiveCell: Story = {
  name: 'Themed active cell (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-notebook-viewer-active-bg` recolors the cell an anchor has scrolled to, without hijacking library-wide `--lr-color-brand-quiet`. Set it on the element or any ancestor — it is not declared on `:host`, so an ancestor value is never shadowed.',
      },
    },
  },
  render: () => html`
    <lr-notebook-viewer
      style="--lr-notebook-viewer-active-bg: ${storyColor('warningQuiet')};"
      name="analysis.ipynb"
      .notebook=${NOTEBOOK}
      .anchor=${{ kind: 'node-path', path: [1] }}
    ></lr-notebook-viewer>
  `,
};

export const FarCellAnchors: Story = {
  parameters: { docs: { description: { story: 'Jump to an identified cell outside the initial virtual window. Scroll away and repeat the same jump to return to its active row inside the capped notebook viewport.' } } },
  render: () => html`
    <div>
      <button type="button" @click=${(event: Event) => {
        const viewer = (event.currentTarget as HTMLElement).parentElement?.querySelector('lr-notebook-viewer');
        void viewer?.scrollToAnchor({ kind: 'fragment', id: 'cell-90' });
      }}>Jump to cell 90</button>
      <lr-notebook-viewer max-height="160px" .notebook=${{
        nbformat: 4, nbformat_minor: 5,
        cells: Array.from({ length: 100 }, (_, index) => ({ cell_type: 'raw', id: `cell-${index}`, source: `Cell ${index}`, metadata: {} })),
      }}></lr-notebook-viewer>
    </div>
  `,
};
