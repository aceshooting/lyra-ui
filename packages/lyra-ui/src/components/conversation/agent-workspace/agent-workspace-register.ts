// Lean entry for conversation shells without optional run, tool, retrieval, grounding or context panels.
// Import those child registration entries when the corresponding data can be supplied.
export * from './agent-workspace.class.js';
import { LyraAgentWorkspace } from './agent-workspace.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../lr-chat-viewport.js';
import '../../lr-chat-message.js';
import '../../lr-markdown.js';
import '../../lr-message-parts.js';
import '../../lr-chat-composer.js';
import '../../lr-empty.js';

defineElement('agent-workspace', LyraAgentWorkspace);
