// Lean entry: import lr-select.js and lr-option.js for the ordinary picker.
// The searchable combobox loads on demand when searchable becomes true.
export * from './currency-picker.class.js';
import { LyraCurrencyPicker } from './currency-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('currency-picker', LyraCurrencyPicker);
