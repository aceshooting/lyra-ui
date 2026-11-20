export type { NotificationDismissReason } from './overlays/toast/toast-region-protocol.js';
export type { SemanticVariant } from '../internal/semantic-variant.js';
export * from './overlays/alert/alert.class.js';
import { defineElement } from '../internal/prefix.js';
import { LyraAlert } from './overlays/alert/alert.class.js';

defineElement('alert', LyraAlert);
