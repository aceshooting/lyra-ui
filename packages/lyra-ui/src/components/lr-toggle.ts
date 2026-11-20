export type { LyraToolbarAction } from './conversation/message-actions/toolbar-actions.js';
export * from './forms/toggle/toggle.class.js';
import { LyraToggle } from './forms/toggle/toggle.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('toggle', LyraToggle);
