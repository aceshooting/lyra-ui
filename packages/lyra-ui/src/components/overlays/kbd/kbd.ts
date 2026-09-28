/** @deprecated Import @aceshooting/lyra-ui/components/lr-kbd.js to register this component. */
export * from './kbd.class.js';
import { LyraKbd } from './kbd.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('kbd', LyraKbd);
