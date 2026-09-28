/** @deprecated Import @aceshooting/lyra-ui/components/lr-color-picker.js to register this component. */
export * from './color-picker.class.js';
import { LyraColorPicker } from './color-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('color-picker', LyraColorPicker);
