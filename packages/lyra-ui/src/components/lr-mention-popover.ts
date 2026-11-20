export * from './utility/mention-popover/mention-popover.class.js';
import { LyraMentionPopover } from './utility/mention-popover/mention-popover.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('mention-popover', LyraMentionPopover);
