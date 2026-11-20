export * from './forms/date-picker/date-input.class.js';
import { LyraDateInput } from './forms/date-picker/date-input.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-date-picker.js';
defineElement('date-input', LyraDateInput);
