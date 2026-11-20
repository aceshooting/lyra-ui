export type { IngestionQueueAction, IngestionQueueStagePresentation } from './retrieval/ingestion-queue/ingestion-queue-presentation.js';
export type { IngestionQueueSource, IngestionStage } from './retrieval/ingestion-queue/ingestion-queue.class.js';
export type { KnowledgeBaseSource, KnowledgeSourceIndexingHealth, KnowledgeSourcePermission, KnowledgeSourceSyncStatus } from './retrieval/knowledge-base/knowledge-base.class.js';
export * from './retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
import './lr-knowledge-base.js';
import { LyraKnowledgeBaseAdmin } from './retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The ingestion queue registers the first time its tab opens.
defineLazyChildren('knowledge-base-admin', {
  'ingestion-queue': () => import('./lr-ingestion-queue.js'),
});
defineElement('knowledge-base-admin', LyraKnowledgeBaseAdmin);
