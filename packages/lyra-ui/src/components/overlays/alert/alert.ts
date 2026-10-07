/** @deprecated Import @aceshooting/lyra-ui/components/lr-alert.js to register this component. */
export * from './alert.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraAlert } from './alert.class.js';

defineElement('alert', LyraAlert);
