export * from './approval-queue.class.js';
import { LyraApprovalQueue } from './approval-queue.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('approval-queue', LyraApprovalQueue);
