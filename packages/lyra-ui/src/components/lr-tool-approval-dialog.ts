export type { ApprovalAction, ApprovalDecision } from './agent-tools/approval-state.js';
export type { ApprovalWaitUntil } from '../internal/approval-wait-until.js';
export * from './agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
import { LyraToolApprovalDialog } from './agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-json-viewer.js';
import './lr-button.js';
defineElement('tool-approval-dialog', LyraToolApprovalDialog);
