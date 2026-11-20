export * from './agent-tools/agent-question/agent-question.class.js';
import { LyraAgentQuestion } from './agent-tools/agent-question/agent-question.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('agent-question', LyraAgentQuestion);
