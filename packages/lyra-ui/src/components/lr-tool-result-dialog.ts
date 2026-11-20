export * from './agent-tools/tool-result-dialog/tool-result-dialog.class.js';
import { LyraToolResultDialog } from './agent-tools/tool-result-dialog/tool-result-dialog.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tool-result-dialog', LyraToolResultDialog);
