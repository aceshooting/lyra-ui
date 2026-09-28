/** @deprecated Import @aceshooting/lyra-ui/components/lr-popover.js to register this component. */
export * from './popover.class.js';
import { LyraPopover } from './popover.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('popover', LyraPopover);
