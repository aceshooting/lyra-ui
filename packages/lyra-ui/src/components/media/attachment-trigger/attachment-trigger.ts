export * from './attachment-trigger.class.js';
import { LyraAttachmentTrigger } from './attachment-trigger.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../layout/menu/menu-item.js";
import "../../layout/menu/menu.js";
defineElement('attachment-trigger', LyraAttachmentTrigger);
