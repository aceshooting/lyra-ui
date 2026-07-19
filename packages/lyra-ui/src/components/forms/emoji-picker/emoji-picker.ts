export * from './emoji-picker.class.js';
import { LyraEmojiPicker } from './emoji-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('emoji-picker', LyraEmojiPicker);
