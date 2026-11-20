export * from './agent-tools/tool-call-chip/tool-call-chip.class.js';
import { LyraToolCallChip } from './agent-tools/tool-call-chip/tool-call-chip.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tool-call-chip', LyraToolCallChip);
