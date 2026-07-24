export * from './approval-queue.class.js';
import '../tool-approval-dialog/tool-approval-dialog.js';
import '../../overlays/badge/badge.js';
import { LyraApprovalQueue } from './approval-queue.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('approval-queue', LyraApprovalQueue);
