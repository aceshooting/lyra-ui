export * from './color-picker.class.js';
import { LyraColorPicker } from './color-picker.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('color-picker', LyraColorPicker);
