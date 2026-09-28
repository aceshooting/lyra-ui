/** @deprecated Import @aceshooting/lyra-ui/components/lr-emoji-picker.js to register this component. */
export * from './emoji-picker.class.js';
import { LyraEmojiPicker } from './emoji-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('emoji-picker', LyraEmojiPicker);
