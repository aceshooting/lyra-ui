export type { LyraPaginationFormat } from './data/pagination/pagination.class.js';
export * from './data/table/table.class.js';
import { LyraTable } from './data/table/table.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-empty.js';
import './lr-spinner.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The pager and skeleton rows register the first time a table pages or shows skeleton loading.
defineLazyChildren('table', {
  pagination: () => import('./lr-pagination.js'),
  skeleton: () => import('./lr-skeleton.js'),
});
defineElement('table', LyraTable);
