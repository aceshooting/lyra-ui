export type { LyraWidgetNode } from '../internal/widget-document.js';
export * from './layout/dashboard-grid/dashboard-grid.class.js';
export * from './layout/dashboard-grid/layout.js';
import { LyraDashboardGrid } from './layout/dashboard-grid/dashboard-grid.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-empty.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// Default cell widgets register the first time a layout entry has no authored cell.
defineLazyChildren('dashboard-grid', {
  widget: () => import('./lr-widget.js'),
  'widget-renderer': () => import('./lr-widget-renderer.js'),
});
defineElement('dashboard-grid', LyraDashboardGrid);
