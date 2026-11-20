export * from './retrieval/ingestion-queue/ingestion-queue.class.js';
import './lr-badge.js';
import './lr-progress-bar.js';
import './lr-empty.js';
import { LyraIngestionQueue } from './retrieval/ingestion-queue/ingestion-queue.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The virtualizer and source pager register the first time a queue virtualizes or pages a source.
defineLazyChildren('ingestion-queue', {
  'virtual-list': () => import('./lr-virtual-list.js'),
  pagination: () => import('./lr-pagination.js'),
});
defineElement('ingestion-queue', LyraIngestionQueue);
