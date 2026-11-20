export type { LyraPaginationFormat } from './data/pagination/pagination.class.js';
export type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../internal/clipboard.js';
export * from './data/data-grid/data-grid.class.js';
import { LyraDataGrid } from './data/data-grid/data-grid.class.js';
import { defineElement } from '../internal/prefix.js';
// The shared loading/error/empty renderer composes <lr-empty> for the built-in error state.
import './lr-empty.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The pager registers the first time a grid paginates.
defineLazyChildren('data-grid', {
  pagination: () => import('./lr-pagination.js'),
});
defineElement('data-grid', LyraDataGrid);
