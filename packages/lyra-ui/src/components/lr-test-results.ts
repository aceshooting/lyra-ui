export * from './agent-tools/test-results/test-results.class.js';
import './lr-empty.js';
import './lr-spinner.js';
import './lr-live-region.js';
import { LyraTestResults } from './agent-tools/test-results/test-results.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The source pager registers the first time results page a data source.
defineLazyChildren('test-results', {
  pagination: () => import('./lr-pagination.js'),
});
defineElement('test-results', LyraTestResults);
