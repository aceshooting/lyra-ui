// Lean entry for dashboards whose layout cells all have authored [cell-id] content.
// Import widget.js and widget-renderer.js if the grid may create default cells.
export * from './dashboard-grid.class.js';
export * from './layout.js';
import { LyraDashboardGrid } from './dashboard-grid.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/empty/empty.js';

defineElement('dashboard-grid', LyraDashboardGrid);
