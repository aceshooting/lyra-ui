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
