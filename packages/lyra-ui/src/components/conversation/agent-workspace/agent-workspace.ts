export * from './agent-workspace.class.js';
import { LyraAgentWorkspace } from './agent-workspace.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('agent-workspace', LyraAgentWorkspace);
