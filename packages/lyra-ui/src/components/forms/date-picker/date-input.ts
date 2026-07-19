export * from './date-input.class.js';
import { LyraDateInput } from './date-input.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "./date-picker.js";
defineElement('date-input', LyraDateInput);
