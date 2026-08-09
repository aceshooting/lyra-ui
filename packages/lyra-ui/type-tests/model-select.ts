import type { LyraModelSelect, LyraModelSelectSelectionDirection } from '../src/lyra.js';

declare const modelSelect: LyraModelSelect;

const input: HTMLInputElement | null = modelSelect.input;
const direction: LyraModelSelectSelectionDirection | null = modelSelect.selectionDirection;
void input;
void direction;

modelSelect.selectionStart = 0;
modelSelect.selectionEnd = 1;
modelSelect.selectionDirection = 'forward';
modelSelect.select();
modelSelect.setSelectionRange(0, 1, 'backward');
modelSelect.setRangeText('replacement');
modelSelect.setRangeText('replacement', 0, 1, 'select');
