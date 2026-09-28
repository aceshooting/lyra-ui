/** @deprecated Import @aceshooting/lyra-ui/components/lr-switch.js to register this component. */
export * from './switch.class.js';
import { LyraSwitch } from './switch.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('switch', LyraSwitch);
