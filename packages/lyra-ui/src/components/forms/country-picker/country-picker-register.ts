// Lean entry: import select.js and option.js for the ordinary picker.
// The searchable combobox loads on demand when searchable becomes true.
export * from './country-picker.class.js';
import { LyraCountryPicker } from './country-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('country-picker', LyraCountryPicker);
