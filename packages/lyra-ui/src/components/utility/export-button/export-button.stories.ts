import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraCsvColumn } from '../../../lyra.js';
import type { LyraExportFormatDescriptor, LyraExportButton } from './export-button.js';

const rows = [
  { id: 'a', name: 'Alpha', score: 92 },
  { id: 'b', name: 'Beta', score: 81 },
  { id: 'c', name: 'Gamma', score: 76 },
];

const columns: LyraCsvColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score' },
];

const meta: Meta = {
  title: 'ExportButton',
  component: 'lr-export-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Format options use unique nonempty formatId values; malformed and later duplicate options are omitted first-wins.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const SingleFormat: Story = {
  render: () => html`
    <lr-export-button filename="demo" .rows=${rows} .columns=${columns}></lr-export-button>
  `,
};

/** Empty caller-owned visible copy keeps the localized default as the native button's name. */
export const EmptyVisibleLabel: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The trigger remains visibly empty while its native button uses the localized export label as an accessible fallback.',
      },
    },
  },
  render: () => html`
    <lr-export-button
      label=""
      .strings=${{ exportButtonLabel: 'Download data' }}
      .rows=${rows}
      .columns=${columns}
    ></lr-export-button>
  `,
};

export const MultiFormatMenu: Story = {
  render: () => html`
    <lr-export-button
      filename="demo"
      .rows=${rows}
      .columns=${columns}
      .formats=${['csv', 'json']}
    ></lr-export-button>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-export-button filename="demo" .rows=${rows} .columns=${columns} disabled></lr-export-button>
  `,
};

export const CustomFormats: Story = {
  render: () => {
    const formats: LyraExportFormatDescriptor[] = [
      {
        formatId: 'xlsx',
        label: 'Excel workbook',
        description: 'Preserves spreadsheet columns and data types',
        extension: 'xlsx',
      },
      {
        formatId: 'pdf',
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
        <lr-export-button
          open
          label="Download report"
          .formats=${formats}
          @lr-export=${handleCustomExport}
        ></lr-export-button>
        <output aria-live="polite">Custom formats emit an event for the application to handle.</output>
      </div>
    `;
  },
};

export const Loading: Story = {
  render: () => html`
    <lr-export-button
      loading
      label="Preparing export"
      .rows=${rows}
      .columns=${columns}
      .formats=${['csv', 'json']}
    ></lr-export-button>
  `,
};

export const NarrowLongContent: Story = {
  render: () => html`
    <div style="inline-size: 20rem; max-inline-size: 100%;">
      <lr-export-button
        open
        aria-label="Download the complete quarterly performance report"
        .formats=${[
          {
            formatId: 'spreadsheet',
            label: 'Spreadsheet with all regional performance metrics',
            description: 'Includes every measured category and the complete reporting history',
          },
          { formatId: 'json', label: 'Machine-readable JSON data' },
        ]}
      ></lr-export-button>
    </div>
  `,
};
