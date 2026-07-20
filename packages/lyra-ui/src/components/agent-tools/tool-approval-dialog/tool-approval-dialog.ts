export * from './tool-approval-dialog.class.js';
import { LyraToolApprovalDialog } from './tool-approval-dialog.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/json-viewer/json-viewer.js';
import '../../forms/button/button.js';
defineElement('tool-approval-dialog', LyraToolApprovalDialog);
