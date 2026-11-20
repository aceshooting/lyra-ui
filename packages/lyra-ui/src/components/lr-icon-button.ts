export type { LyraToolbarAction } from '../internal/toolbar-actions.js';
export * from './forms/icon-button/icon-button.class.js';
import './lr-icon.js';
import { LyraIconButton } from './forms/icon-button/icon-button.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('icon-button', LyraIconButton);
