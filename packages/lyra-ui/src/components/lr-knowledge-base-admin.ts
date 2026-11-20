export * from './retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
import './lr-knowledge-base.js';
import './lr-ingestion-queue.js';
import { LyraKnowledgeBaseAdmin } from './retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('knowledge-base-admin', LyraKnowledgeBaseAdmin);
