import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './knowledge-base.js';
import type { KnowledgeBaseSource, KnowledgeSource } from './knowledge-base.class.js';

const meta: Meta = {
  title: 'Knowledge Base',
  component: 'lr-knowledge-base',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A controlled knowledge-source list that omits malformed, blank-id, and later duplicate sources first-wins before summary totals, empty state, table rows, and source actions.',
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
  render: () => html`<lr-knowledge-base style="max-width:56rem" .sources=${sources} without-summary></lr-knowledge-base>`,
};

export const ReadOnly: Story = {
  name: 'Read-only (create hidden)',
  render: () => html`<lr-knowledge-base style="max-width:56rem" .sources=${sources} without-create></lr-knowledge-base>`,
};

export const ActionTriggerTheming: Story = {
  name: 'Action trigger theming',
  render: () => html`
    <style>
      lr-knowledge-base.action-trigger-theming::part(actions-trigger) {
        color: var(--lr-color-brand);
      }
    </style>
    <lr-knowledge-base
      class="action-trigger-theming"
      style="max-width:56rem; font-family:var(--lr-font-mono)"
      .sources=${sources}
    ></lr-knowledge-base>
  `,
};

export const Empty: Story = {
  render: () => html`<lr-knowledge-base style="max-width:56rem"></lr-knowledge-base>`,
};

export const LoadFailed: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Listen for lr-retry-request to start a new load. Call preventDefault() to keep the error visible while the host controls retry timing.',
      },
    },
  },
  name: 'Load failed (error)',
  render: () => html`<lr-knowledge-base
    style="max-width:56rem"
    error
    error-description="Check your connection and retry."
    .sources=${sources}
  ></lr-knowledge-base>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`<div style="max-width:320px"><lr-knowledge-base .sources=${sources}></lr-knowledge-base></div>`,
};

/** A provider returns already ordered pages and authoritative full-source counts. */
export const ServerPages: Story = {
  render: () => {
    const total = 240;
    const record = (index: number) => ({ key: `source-${index}`, order: index, value: { id: `source-${index}`, name: `Source ${String(index + 1).padStart(3, '0')}`, syncStatus: 'synced' as const } });
    const indexOf = (key: string): number | null => {
      if (!/^source-\d+$/.test(key)) return null;
      const index = Number(key.slice(7));
      return Number.isSafeInteger(index) && index >= 0 && index < total ? index : null;
    };
    const source: KnowledgeBaseSource = {
      revision: 1,
      query: async ({ page, pageSize, query }) => ({
        total,
        summary: { total, synced: total, syncing: 0, attention: 0 },
        rows: Array.from({ length: Math.min(pageSize, Math.max(0, total - page * pageSize)) }, (_, offset) => {
          const order = page * pageSize + offset;
          const index = query.sortDir === 'desc' ? total - order - 1 : order;
          return record(index);
        }),
      }),
      lookup: async keys => keys.flatMap(key => { const index = indexOf(key); return index === null ? [] : [record(index)]; }),
      locate: async (key, query) => { const index = indexOf(key); return index === null ? null : query.sortDir === 'desc' ? total - index - 1 : index; },
    };
    return html`<lr-knowledge-base .dataSource=${source} .sourcePageSize=${25}></lr-knowledge-base>`;
  },
};
