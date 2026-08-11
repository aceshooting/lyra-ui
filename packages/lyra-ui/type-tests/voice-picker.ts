import type { LyraVoicePicker, LyraVoicePickerSelectionDirection } from '../src/lyra.js';

declare const voicePicker: LyraVoicePicker;

const input: HTMLInputElement | null = voicePicker.input;
const direction: LyraVoicePickerSelectionDirection | null = voicePicker.selectionDirection;
void input;
void direction;

voicePicker.selectionStart = 0;
voicePicker.selectionEnd = 1;
voicePicker.selectionDirection = 'forward';
voicePicker.select();
voicePicker.setSelectionRange(0, 1, 'backward');
voicePicker.setRangeText('replacement');
voicePicker.setRangeText('replacement', 0, 1, 'select');
