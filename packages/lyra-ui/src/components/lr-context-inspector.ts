// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export * from './agent-tools/context-inspector/context-inspector.class.js';
import { LyraContextInspector } from './agent-tools/context-inspector/context-inspector.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-context-meter.js';
import './lr-copy-button.js';
import './lr-export-button.js';
import './lr-citation-badge.js';
import './lr-empty.js';
defineElement('context-inspector', LyraContextInspector);
