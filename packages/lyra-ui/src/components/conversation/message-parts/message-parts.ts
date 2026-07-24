export * from './message-parts.class.js';
import '../../agent-tools/thinking-panel/thinking-panel.js';
import '../../agent-tools/tool-call-chip/tool-call-chip.js';
import '../../agent-tools/tool-result-view/tool-result-view.js';
import '../../forms/button/button.js';
import '../../media/attachment-chip/attachment-chip.js';
import '../../retrieval/citation-badge/citation-badge.js';
import '../../utility/json-viewer/json-viewer.js';
import '../markdown/markdown.js';
import '../widget-renderer/widget-renderer.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraMessageParts } from './message-parts.class.js';

defineElement('message-parts', LyraMessageParts);
