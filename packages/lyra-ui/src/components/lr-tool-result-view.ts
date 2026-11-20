// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export type { ToolRendererRegistry } from './agent-tools/tool-result-view/registry.js';
export type { ToolStatus } from './agent-tools/tool-status.js';
export * from './agent-tools/tool-result-view/tool-result-view.class.js';
import { LyraToolResultView } from './agent-tools/tool-result-view/tool-result-view.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-json-viewer.js';
import './lr-skeleton.js';
import './lr-copy-button.js';
defineElement('tool-result-view', LyraToolResultView);
