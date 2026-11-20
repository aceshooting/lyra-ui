export * from './agent-tools/thinking-panel/thinking-panel.class.js';
import { LyraThinkingPanel } from './agent-tools/thinking-panel/thinking-panel.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('thinking-panel', LyraThinkingPanel);
