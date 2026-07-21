import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './knowledge-base-admin.js';
import type { KnowledgeSource } from '../knowledge-base/knowledge-base.class.js';
import type { IngestionQueueItem } from '../ingestion-queue/ingestion-queue.class.js';

const meta: Meta = { title: 'KnowledgeBaseAdmin', component: 'lr-knowledge-base-admin', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const sources: KnowledgeSource[] = [{ id: 'drive', name: 'Product docs', type: 'drive', syncStatus: 'synced', indexingHealth: 'healthy', documentCount: 124 }];
const ingestionItems: IngestionQueueItem[] = [{ id: 'doc-1', document: { id: 'doc-1', name: 'runbook.md' }, stage: 'embedding', progress: 65, chunkCount: 18, embeddedChunkCount: 12 }];

export const Sources: Story = { render: () => html`<lr-knowledge-base-admin .sources=${sources} .ingestionItems=${ingestionItems}></lr-knowledge-base-admin>` };
export const Ingestion: Story = { render: () => html`<lr-knowledge-base-admin active-tab="ingestion" .sources=${sources} .ingestionItems=${ingestionItems}></lr-knowledge-base-admin>` };
