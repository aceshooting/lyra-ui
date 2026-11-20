export * from './forms/emoji-picker/emoji-picker.class.js';
import { LyraEmojiPicker } from './forms/emoji-picker/emoji-picker.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('emoji-picker', LyraEmojiPicker);
