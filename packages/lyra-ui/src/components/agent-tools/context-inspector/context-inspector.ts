// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export * from './context-inspector.class.js';
import { LyraContextInspector } from './context-inspector.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../data/context-meter/context-meter.js';
import '../../utility/copy-button/copy-button.js';
import '../../utility/export-button/export-button.js';
import '../../retrieval/citation-badge/citation-badge.js';
import '../../overlays/empty/empty.js';
defineElement('context-inspector', LyraContextInspector);
