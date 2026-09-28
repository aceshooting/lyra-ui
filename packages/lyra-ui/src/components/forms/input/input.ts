/** @deprecated Import @aceshooting/lyra-ui/components/lr-input.js to register this component. */
export * from './input.class.js';
import { LyraInput } from './input.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('input', LyraInput);
