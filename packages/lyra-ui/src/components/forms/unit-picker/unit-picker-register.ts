// Lean entry: import lr-select.js and lr-option.js for the ordinary picker.
// The searchable combobox loads on demand when searchable becomes true.
export * from './unit-picker.class.js';
import { LyraUnitPicker } from './unit-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('unit-picker', LyraUnitPicker);
