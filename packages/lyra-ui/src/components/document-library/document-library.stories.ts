import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './document-library.js';
import type { LibraryDocument } from './document-library.class.js';

const meta: Meta = {
  title: 'DocumentLibrary',
  component: 'lr-document-library',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A searchable, filterable document inventory with versions, tags, owners, freshness, and bulk selection, built on lr-table, lr-chip-group, lr-input, lr-combobox, and lr-file-icon.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const documents: LibraryDocument[] = [
  {
    id: 'd1',
    name: 'Alpha Overview.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    version: 'v10',
    owner: 'Jordan Lee',
    tags: ['onboarding', 'handbook'],
    freshness: 'fresh',
    updatedAt: '2024-06-01T00:00:00.000Z',
  },
  {
    id: 'd2',
    name: 'Zeta Runbook.pdf',
    mimeType: 'application/pdf',
    version: 'v2',
    owner: 'Priya Nair',
    tags: ['ops', 'runbook'],
    freshness: 'stale',
    updatedAt: '2024-01-05T00:00:00.000Z',
  },
  {
    id: 'd3',
    name: 'Mid Spec.md',
    mimeType: 'text/markdown',
    version: 'v1',
    owner: 'Alex Chen',
    tags: ['spec'],
    freshness: 'aging',
    updatedAt: '2024-03-15T00:00:00.000Z',
  },
  {
    id: 'd4',
    name: 'Quarterly Metrics.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    version: 'v5',
    owner: 'Jordan Lee',
    tags: ['ops', 'metrics'],
    freshness: 'fresh',
    updatedAt: '2024-06-10T00:00:00.000Z',
  },
];

export const Default: Story = {
  render: () => html`<lr-document-library .documents=${documents}></lr-document-library>`,
};

export const WithSelection: Story = {
  render: () =>
    html`<lr-document-library .documents=${documents} .selectedIds=${['d1', 'd4']}></lr-document-library>`,
};

export const Empty: Story = {
  render: () => html`<lr-document-library></lr-document-library>`,
};

export const NarrowAllocation: Story = {
  name: 'Document inventory at a 320px allocation',
  parameters: {
    docs: {
      description: {
        story:
          'At a 320px allocation, the low-priority tags/freshness/updated columns hide (via lr-table\'s own priority mechanism) and only select/type/name stay visible, mirroring lr-table\'s own narrow-container story.',
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%;">
      <lr-document-library .documents=${documents}></lr-document-library>
    </div>
  `,
};
