import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './knowledge-base.js';
import type { KnowledgeSource } from './knowledge-base.class.js';

const meta: Meta = {
  title: 'Knowledge Base',
  component: 'lr-knowledge-base',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A knowledge-base source list: sync status, indexing health, permissions, and per-row create/sync/pause/delete affordances. A controlled data view -- it emits lr-kb-create/-sync/-pause/-delete request events for the host to act on and reflect back into a new `sources` value.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const sources: KnowledgeSource[] = [
  {
    id: '1',
    name: 'Product Drive',
    type: 'drive',
    syncStatus: 'synced',
    indexingHealth: 'healthy',
    permission: 'owner',
    documentCount: 128,
    lastSyncedAt: new Date(),
  },
  {
    id: '2',
    name: 'Support Notion',
    type: 'notion',
    syncStatus: 'syncing',
    indexingHealth: 'degraded',
    permission: 'editor',
    documentCount: 42,
  },
  {
    id: '3',
    name: 'Legal URLs',
    type: 'url',
    syncStatus: 'paused',
    indexingHealth: 'unknown',
    permission: 'viewer',
    documentCount: 7,
  },
  {
    id: '4',
    name: 'Broken Feed',
    syncStatus: 'error',
    indexingHealth: 'failed',
    permission: 'restricted',
    errorMessage: 'Connector token expired',
  },
];

export const Default: Story = {
  render: () => html`<lr-knowledge-base style="max-width:56rem" .sources=${sources}></lr-knowledge-base>`,
};

export const NoSummary: Story = {
  name: 'Summary hidden',
  render: () => html`<lr-knowledge-base style="max-width:56rem" .sources=${sources} hide-summary></lr-knowledge-base>`,
};

export const ReadOnly: Story = {
  name: 'Read-only (create hidden)',
  render: () => html`<lr-knowledge-base style="max-width:56rem" .sources=${sources} hide-create></lr-knowledge-base>`,
};

export const Empty: Story = {
  render: () => html`<lr-knowledge-base style="max-width:56rem"></lr-knowledge-base>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`<div style="max-width:320px"><lr-knowledge-base .sources=${sources}></lr-knowledge-base></div>`,
};
