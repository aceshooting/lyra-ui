export * from './locale-picker.class.js';
import { LyraLocalePicker } from './locale-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/flag/flag.js';
defineElement('locale-picker', LyraLocalePicker);
