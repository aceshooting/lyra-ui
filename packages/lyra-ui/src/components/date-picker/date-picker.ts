export * from './date-picker.class.js';
import { LyraDatePicker } from './date-picker.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('date-picker', LyraDatePicker);
