/** @deprecated Import @aceshooting/lyra-ui/components/lr-voice-picker.js to register this component. */
export * from './voice-picker.class.js';
import { LyraVoicePicker } from './voice-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('voice-picker', LyraVoicePicker);
