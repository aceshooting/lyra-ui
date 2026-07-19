export * from './dashboard-grid.class.js';
export * from './layout.js';
import { LyraDashboardGrid } from './dashboard-grid.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../empty/empty.js';
import '../widget/widget.js';
import '../widget-renderer/widget-renderer.js';
defineElement('dashboard-grid', LyraDashboardGrid);
