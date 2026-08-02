export * from './copy-button.class.js';
import '../../overlays/overlay/tooltip.js';
import { LyraCopyButton } from './copy-button.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('copy-button', LyraCopyButton);
