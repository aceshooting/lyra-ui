export * from './retrieval/retrieval-results/retrieval-results.class.js';
import { LyraRetrievalResults } from './retrieval/retrieval-results/retrieval-results.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chunk-inspector.js';
import './lr-checkbox.js';
import './lr-spinner.js';
import './lr-empty.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The virtualizer and source pager register the first time a list virtualizes or pages a source.
defineLazyChildren('retrieval-results', {
  'virtual-list': () => import('./lr-virtual-list.js'),
  pagination: () => import('./lr-pagination.js'),
});
defineElement('retrieval-results', LyraRetrievalResults);
