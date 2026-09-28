/** @deprecated Import @aceshooting/lyra-ui/components/lr-date-picker.js to register this component. */
export * from './date-picker.class.js';
import { LyraDatePicker } from './date-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('date-picker', LyraDatePicker);
