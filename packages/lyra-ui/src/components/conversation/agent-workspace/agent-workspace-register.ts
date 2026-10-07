// Lean entry for conversation shells without optional run, tool, retrieval, grounding or context panels.
// Import those child registration entries when the corresponding data can be supplied.
export * from './agent-workspace.class.js';
import { LyraAgentWorkspace } from './agent-workspace.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../chat-viewport/chat-viewport.js';
import '../chat-message/chat-message.js';
import '../markdown/markdown.js';
import '../message-parts/message-parts.js';
import '../chat-composer/chat-composer.js';
import '../../overlays/empty/empty.js';

defineElement('agent-workspace', LyraAgentWorkspace);
