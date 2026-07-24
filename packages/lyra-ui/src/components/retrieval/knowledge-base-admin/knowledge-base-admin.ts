export * from './knowledge-base-admin.class.js';
import '../knowledge-base/knowledge-base.js';
import '../ingestion-queue/ingestion-queue.js';
import { LyraKnowledgeBaseAdmin } from './knowledge-base-admin.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('knowledge-base-admin', LyraKnowledgeBaseAdmin);
