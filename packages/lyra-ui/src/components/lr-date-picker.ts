export * from './forms/date-picker/date-picker.class.js';
import { LyraDatePicker } from './forms/date-picker/date-picker.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('date-picker', LyraDatePicker);
