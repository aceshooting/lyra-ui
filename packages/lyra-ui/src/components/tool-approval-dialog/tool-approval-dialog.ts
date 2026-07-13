export * from './tool-approval-dialog.class.js';
import { LyraToolApprovalDialog } from './tool-approval-dialog.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../json-viewer/json-viewer.js";
defineElement('tool-approval-dialog', LyraToolApprovalDialog);
