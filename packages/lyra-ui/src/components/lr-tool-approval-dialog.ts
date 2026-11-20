export * from './agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
import { LyraToolApprovalDialog } from './agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-json-viewer.js';
import './lr-button.js';
defineElement('tool-approval-dialog', LyraToolApprovalDialog);
