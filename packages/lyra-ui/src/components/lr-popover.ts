export * from './overlays/overlay/popover.class.js';
import { LyraPopover } from './overlays/overlay/popover.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('popover', LyraPopover);
