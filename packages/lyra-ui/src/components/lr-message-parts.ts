// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export type { LyraThinkingPanelEventMap, ThinkingPanelToggleDetail } from './agent-tools/thinking-panel/thinking-panel.class.js';
export type { LyraToolCallBlockEventMap, ToolCallBlockRenderErrorDetail, ToolCallBlockToggleDetail } from './agent-tools/tool-call-block/tool-call-block.class.js';
export type { LyraToolCallChipEventMap } from './agent-tools/tool-call-chip/tool-call-chip.class.js';
export type { LyraToolResultViewEventMap } from './agent-tools/tool-result-view/tool-result-view.class.js';
export type { MarkdownStreamingRender } from './conversation/markdown/markdown-shared.js';
export type { LyraMarkdownEventMap } from './conversation/markdown/markdown.class.js';
export type { LyraWidgetRendererEventMap } from './conversation/widget-renderer/widget-renderer.class.js';
export type { LyraAttachmentChipEventMap } from './media/attachment-chip/attachment-chip.class.js';
export type { LyraCitationBadgeEventMap } from './retrieval/citation-badge/citation-badge.class.js';
export type { LyraJsonViewerEventMap } from './utility/json-viewer/json-viewer.class.js';
export type { LyraWidgetTypeRegistry } from '../internal/widget-type-registry.js';
export * from './conversation/message-parts/message-parts.class.js';
export type {} from './lr-button.js';
export type {} from './lr-details.js';
export type {} from './lr-icon-button.js';
export type {} from './overlays/overlay/tooltip.class.js';
import './lr-markdown.js';
import { defineElement } from '../internal/prefix.js';
import { LyraMessageParts } from './conversation/message-parts/message-parts.class.js';

defineElement('message-parts', LyraMessageParts);
