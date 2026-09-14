// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export * from './evaluation-run.class.js';
import '../../utility/live-region/live-region.js';
import '../../overlays/progress/progress-bar.js';
import '../../overlays/empty/empty.js';
import '../../layout/details/details.js';
import '../../overlays/badge/badge.js';
import '../../conversation/markdown/markdown.js';
import '../../conversation/code-block/code-block.js';
import '../../retrieval/grounding-summary/grounding-summary.js';
import '../tool-timeline/tool-timeline.js';
import { LyraEvalRun } from './evaluation-run.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('eval-run', LyraEvalRun);
