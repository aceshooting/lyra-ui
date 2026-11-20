export * from './conversation/voice-picker/voice-picker.class.js';
import { LyraVoicePicker } from './conversation/voice-picker/voice-picker.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('voice-picker', LyraVoicePicker);
