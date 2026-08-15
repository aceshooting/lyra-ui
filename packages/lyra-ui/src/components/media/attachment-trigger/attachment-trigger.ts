export * from './attachment-trigger.class.js';
import { LyraAttachmentTrigger } from './attachment-trigger.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/menu/menu-item.js';
import '../../overlays/overlay/dropdown.js';
defineElement('attachment-trigger', LyraAttachmentTrigger);
