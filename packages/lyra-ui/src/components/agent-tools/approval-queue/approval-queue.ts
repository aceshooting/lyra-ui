/** @deprecated Import @aceshooting/lyra-ui/components/lr-approval-queue.js to register this component. */
export * from './approval-queue.class.js';
import '../../overlays/badge/badge.js';
import { LyraApprovalQueue } from './approval-queue.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { defineLazyChildren } from '../../../internal/lazy-children.js';
// The approval dialog registers the first time a request is opened.
defineLazyChildren('approval-queue', {
  'tool-approval-dialog': () => import('../tool-approval-dialog/tool-approval-dialog.js'),
});
defineElement('approval-queue', LyraApprovalQueue);
