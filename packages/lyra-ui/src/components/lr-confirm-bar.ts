export type { ApprovalAction, ApprovalDecision } from './agent-tools/approval-state.js';
export type { ApprovalWaitUntil } from '../internal/approval-wait-until.js';
export * from './agent-tools/confirm-bar/confirm-bar.class.js';
import { LyraConfirmBar } from './agent-tools/confirm-bar/confirm-bar.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-live-region.js';
import './lr-button.js';
defineElement('confirm-bar', LyraConfirmBar);
