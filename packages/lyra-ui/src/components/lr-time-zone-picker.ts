export * from './forms/time-zone-picker/time-zone-picker.class.js';
import { LyraTimeZonePicker } from './forms/time-zone-picker/time-zone-picker.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-select.js';
import './lr-option.js';
defineElement('time-zone-picker', LyraTimeZonePicker);
