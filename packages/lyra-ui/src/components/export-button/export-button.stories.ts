import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { CsvColumn } from '../../lyra.js';
import type { ExportFormatDescriptor, LyraExportButton } from './export-button.js';

const rows = [
  { id: 'a', name: 'Alpha', score: 92 },
  { id: 'b', name: 'Beta', score: 81 },
  { id: 'c', name: 'Gamma', score: 76 },
];

const columns: CsvColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score' },
];

const meta: Meta = {
  title: 'ExportButton',
  component: 'lyra-export-button',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const SingleFormat: Story = {
  render: () => html`
    <lyra-export-button filename="demo" .rows=${rows} .columns=${columns}></lyra-export-button>
  `,
};

export const MultiFormatMenu: Story = {
  render: () => html`
    <lyra-export-button
      filename="demo"
      .rows=${rows}
      .columns=${columns}
      .formats=${['csv', 'json']}
    ></lyra-export-button>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lyra-export-button filename="demo" .rows=${rows} .columns=${columns} disabled></lyra-export-button>
  `,
};

export const CustomFormats: Story = {
  render: () => {
    const formats: ExportFormatDescriptor[] = [
      {
        id: 'xlsx',
        label: 'Excel workbook',
        description: 'Preserves spreadsheet columns and data types',
        extension: 'xlsx',
      },
      {
        id: 'pdf',
        label: 'PDF report',
        description: 'Produces a presentation-ready document',
        extension: 'pdf',
      },
    ];

    const handleCustomExport = (event: CustomEvent<{ format: string }>) => {
      event.preventDefault();
      const button = event.currentTarget as LyraExportButton;
      const output = button.parentElement?.querySelector('output');
      button.loading = true;
      if (output) output.textContent = `Generating ${event.detail.format.toUpperCase()}…`;
      window.setTimeout(() => {
        button.loading = false;
        if (output) output.textContent = `${event.detail.format.toUpperCase()} export handled by the application.`;
      }, 900);
    };

    return html`
      <div>
        <lyra-export-button
          open
          label="Download report"
          .formats=${formats}
          @lyra-export=${handleCustomExport}
        ></lyra-export-button>
        <output aria-live="polite">Custom formats emit an event for the application to handle.</output>
      </div>
    `;
  },
};

export const Loading: Story = {
  render: () => html`
    <lyra-export-button
      loading
      label="Preparing export"
      .rows=${rows}
      .columns=${columns}
      .formats=${['csv', 'json']}
    ></lyra-export-button>
  `,
};

export const NarrowLongContent: Story = {
  render: () => html`
    <div style="inline-size: 20rem; max-inline-size: 100%;">
      <lyra-export-button
        open
        aria-label="Download the complete quarterly performance report"
        .formats=${[
          {
            id: 'spreadsheet',
            label: 'Spreadsheet with all regional performance metrics',
            description: 'Includes every measured category and the complete reporting history',
          },
          { id: 'json', label: 'Machine-readable JSON data' },
        ]}
      ></lyra-export-button>
    </div>
  `,
};
