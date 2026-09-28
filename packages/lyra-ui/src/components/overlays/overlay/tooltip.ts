/** @deprecated Import @aceshooting/lyra-ui/components/lr-tooltip.js to register this component. */
export * from './tooltip.class.js';
import { LyraTooltip } from './tooltip.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('tooltip', LyraTooltip);
