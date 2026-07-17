export * from './voice-picker.class.js';
import { LyraVoicePicker } from './voice-picker.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('voice-picker', LyraVoicePicker);
