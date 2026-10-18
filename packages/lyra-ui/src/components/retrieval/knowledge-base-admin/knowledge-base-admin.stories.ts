import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './knowledge-base-admin.js';
import type { KnowledgeBaseSource, KnowledgeSource } from '../knowledge-base/knowledge-base.class.js';
import type { IngestionQueueSource, IngestionQueueItem } from '../ingestion-queue/ingestion-queue.class.js';

const meta: Meta = { title: 'KnowledgeBaseAdmin', component: 'lr-knowledge-base-admin', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const sources: KnowledgeSource[] = [{ id: 'drive', name: 'Product docs', type: 'drive', syncStatus: 'synced', indexingHealth: 'healthy', documentCount: 124 }];
const ingestionItems: IngestionQueueItem[] = [{ id: 'doc-1', document: { id: 'doc-1', name: 'runbook.md' }, stage: 'embedding', progress: 65, chunkCount: 18, embeddedChunkCount: 12 }];

export const Sources: Story = { render: () => html`<lr-knowledge-base-admin .sources=${sources} .ingestionItems=${ingestionItems}></lr-knowledge-base-admin>` };
export const Ingestion: Story = { render: () => html`<lr-knowledge-base-admin active-tab="ingestion" .sources=${sources} .ingestionItems=${ingestionItems}></lr-knowledge-base-admin>` };
export const UnavailableIngestionFallback: Story = {
  name: 'Unavailable ingestion tab',
  parameters: {
    docs: {
      description: {
        story:
          'When `without-ingestion` makes the controlled active tab unavailable, the component normalizes `activeTab` to Sources through `lr-tab-change`.',
      },
    },
  },
  render: () => html`
    <lr-knowledge-base-admin
      active-tab="ingestion"
      without-ingestion
      .sources=${sources}
      .ingestionItems=${ingestionItems}
    ></lr-knowledge-base-admin>
  `,
};

export const InvalidActiveTabFallback: Story = {
  name: 'Invalid active tab fallback',
  parameters: {
    docs: {
      description: {
        story: 'An invalid authored tab value normalizes to Sources, leaving one active tab and one visible panel.',
      },
    },
  },
  render: () => html`
    <lr-knowledge-base-admin
      active-tab="unknown"
      .sources=${sources}
      .ingestionItems=${ingestionItems}
    ></lr-knowledge-base-admin>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow allocation (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-knowledge-base-admin .sources=${sources} .ingestionItems=${ingestionItems}></lr-knowledge-base-admin>
    </div>
  `,
};

export const InputAdmissionNotice: Story = {
  parameters: { docs: { description: { story: 'Each active tab discloses its original input admission limit. Inactive tab content remains unmounted.' } } },
  render: () => html`<lr-knowledge-base-admin .sources=${Array.from({ length: 12000 }, (_, i) => ({ ...sources[0]!, id: `s${i}` }))} .ingestionItems=${ingestionItems}></lr-knowledge-base-admin>`,
};

export const Providers: Story = {
  parameters: { docs: { description: { story: 'Only the active panel queries its provider. Switching back mounts a fresh child at page zero; provider removal restores the corresponding legacy collection.' } } },
  render: () => {
    const sourceRecords = sources.map((value, order) => ({ key: value.id, order, value }));
    const ingestionRecords = ingestionItems.map((value, order) => ({ key: value.id, order, value }));
    const dataSource: KnowledgeBaseSource = {
      revision: 1,
      query: async ({ page, pageSize }) => ({ total: sourceRecords.length, summary: { total: sourceRecords.length, synced: sourceRecords.length, syncing: 0, attention: 0 }, rows: sourceRecords.slice(page * pageSize, (page + 1) * pageSize) }),
      lookup: async keys => sourceRecords.filter(record => keys.includes(record.key)),
      locate: async key => sourceRecords.find(record => record.key === key)?.order ?? null,
    };
    const ingestionSource: IngestionQueueSource = {
      revision: 1,
      query: async ({ page, pageSize }) => ({ total: ingestionRecords.length, rows: ingestionRecords.slice(page * pageSize, (page + 1) * pageSize) }),
      lookup: async keys => ingestionRecords.filter(record => keys.includes(record.key)),
      locate: async key => ingestionRecords.find(record => record.key === key)?.order ?? null,
    };
    return html`<lr-knowledge-base-admin .dataSource=${dataSource} .ingestionSource=${ingestionSource}></lr-knowledge-base-admin>`;
  },
};
