// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export * from './tool-timeline.class.js';
import '../tool-call-chip/tool-call-chip.js';
import '../tool-result-view/tool-result-view.js';
import '../tool-approval-dialog/tool-approval-dialog.js';
import '../../layout/details/details.js';
import '../../overlays/empty/empty.js';
import { LyraToolTimeline } from './tool-timeline.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('tool-timeline', LyraToolTimeline);
