export type { ApprovalAction, ApprovalDecision } from './agent-tools/approval-state.js';
export type { ToolApprovalDialogCloseReason } from './agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
export type { ApprovalWaitUntil } from '../internal/approval-wait-until.js';
export * from './agent-tools/approval-queue/approval-queue.class.js';
import './lr-badge.js';
import { LyraApprovalQueue } from './agent-tools/approval-queue/approval-queue.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The approval dialog registers the first time a request is opened.
defineLazyChildren('approval-queue', {
  'tool-approval-dialog': () => import('./lr-tool-approval-dialog.js'),
});
defineElement('approval-queue', LyraApprovalQueue);
