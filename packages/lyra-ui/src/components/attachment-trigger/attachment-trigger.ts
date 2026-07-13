export * from './attachment-trigger.class.js';
import { LyraAttachmentTrigger } from './attachment-trigger.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../menu/menu-item.js";
import "../menu/menu.js";
defineElement('attachment-trigger', LyraAttachmentTrigger);
