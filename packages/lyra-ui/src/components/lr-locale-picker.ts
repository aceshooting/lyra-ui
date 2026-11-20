export * from './forms/locale-picker/locale-picker.class.js';
import { LyraLocalePicker } from './forms/locale-picker/locale-picker.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-flag.js';
defineElement('locale-picker', LyraLocalePicker);
