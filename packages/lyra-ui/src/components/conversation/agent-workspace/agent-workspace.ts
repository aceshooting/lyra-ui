// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export * from './agent-workspace.class.js';
import '../chat-viewport/chat-viewport.js';
import '../chat-message/chat-message.js';
import '../markdown/markdown.js';
import '../message-parts/message-parts.js';
import '../chat-composer/chat-composer.js';
import '../../agent-tools/agent-run/agent-run.js';
import '../../agent-tools/tool-timeline/tool-timeline.js';
import '../../retrieval/retrieval-results/retrieval-results.js';
import '../../retrieval/grounding-summary/grounding-summary.js';
import '../../agent-tools/context-inspector/context-inspector.js';
import '../../overlays/empty/empty.js';
import { LyraAgentWorkspace } from './agent-workspace.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('agent-workspace', LyraAgentWorkspace);
