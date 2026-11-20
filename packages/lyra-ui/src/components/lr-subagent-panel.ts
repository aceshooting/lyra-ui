export * from './agent-tools/subagent-panel/subagent-panel.class.js';
import { LyraSubagentPanel } from './agent-tools/subagent-panel/subagent-panel.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-badge.js';
import './lr-empty.js';

defineElement('subagent-panel', LyraSubagentPanel);

