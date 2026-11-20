export * from './forms/color-picker/color-picker.class.js';
import { LyraColorPicker } from './forms/color-picker/color-picker.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('color-picker', LyraColorPicker);
