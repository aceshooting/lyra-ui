export * from './overlays/overlay/tooltip.class.js';
import { LyraTooltip } from './overlays/overlay/tooltip.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tooltip', LyraTooltip);
