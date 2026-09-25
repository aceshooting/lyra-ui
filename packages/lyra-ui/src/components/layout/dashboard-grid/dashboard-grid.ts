export * from './dashboard-grid.class.js';
export * from './layout.js';
import { LyraDashboardGrid } from './dashboard-grid.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/empty/empty.js';
import '../widget/widget.js';
import '../../conversation/widget-renderer/widget-renderer.js';
defineElement('dashboard-grid', LyraDashboardGrid);
// policy-allow(component-dependency: lr-icon): Markdown's optional copy chrome uses the lean
// copy-button entry, whose icon-button renders supplied SVG glyphs and never requests lr-icon.
