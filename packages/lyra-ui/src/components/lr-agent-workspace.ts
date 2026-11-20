// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export type { AgentRunCancelDetail } from './agent-tools/agent-run/agent-run.class.js';
export type { ContextInspectorRedaction } from './agent-tools/context-inspector/context-inspector.class.js';
export type { ToolTimelineApprovalDetail } from './agent-tools/tool-timeline/tool-timeline.class.js';
export type { ChatComposerWrap } from './conversation/chat-composer/chat-composer.class.js';
export type { MarkdownStreamingRender } from './conversation/markdown/markdown-shared.js';
export type { ContextMeterTone } from './data/context-meter/context-meter.class.js';
export type { BadgeVariant } from './overlays/badge/badge.class.js';
export type { RetrievalResultsSelectDetail } from './retrieval/retrieval-results/retrieval-results.class.js';
export type { ChatComposerStatus } from '../internal/chat-composer-status.js';
export * from './conversation/agent-workspace/agent-workspace.class.js';
import './lr-chat-viewport.js';
import './lr-chat-message.js';
import './lr-markdown.js';
import './lr-message-parts.js';
import './lr-chat-composer.js';
import './lr-empty.js';
import { LyraAgentWorkspace } from './conversation/agent-workspace/agent-workspace.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';

// Each details panel registers the first time the workspace has data for it.
defineLazyChildren('agent-workspace', {
  'agent-run': () => import('./lr-agent-run.js'),
  'tool-timeline': () => import('./lr-tool-timeline.js'),
  'retrieval-results': () => import('./lr-retrieval-results.js'),
  'grounding-summary': () => import('./lr-grounding-summary.js'),
  'context-inspector': () => import('./lr-context-inspector.js'),
});
defineElement('agent-workspace', LyraAgentWorkspace);
