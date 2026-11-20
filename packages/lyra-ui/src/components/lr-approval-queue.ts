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
