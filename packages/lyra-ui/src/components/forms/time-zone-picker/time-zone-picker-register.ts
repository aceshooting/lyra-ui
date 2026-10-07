// Lean entry: import select.js and option.js for the ordinary picker.
// The searchable combobox loads on demand when searchable becomes true.
export * from './time-zone-picker.class.js';
import { LyraTimeZonePicker } from './time-zone-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('time-zone-picker', LyraTimeZonePicker);
