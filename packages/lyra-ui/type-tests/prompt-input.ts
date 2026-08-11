import type {
  ChatComposerSelectionDirection,
  ChatComposerWrap,
  LyraPromptInput,
} from '../src/lyra.js';

declare const promptInput: LyraPromptInput;

const input: HTMLTextAreaElement | null = promptInput.input;
const direction: ChatComposerSelectionDirection | null = promptInput.selectionDirection;
const wrap: ChatComposerWrap = promptInput.wrap;
void input;
void direction;
void wrap;

promptInput.spellcheck = false;
promptInput.autocapitalize = 'sentences';
promptInput.autoCorrect = 'on';
promptInput.wrap = 'hard';
promptInput.autocomplete = 'off';
promptInput.inputMode = 'text';
promptInput.enterKeyHint = 'send';
promptInput.selectionStart = 0;
promptInput.selectionEnd = 1;
promptInput.selectionDirection = 'forward';
promptInput.select();
promptInput.setSelectionRange(0, 1, 'backward');
promptInput.setRangeText('replacement');
promptInput.setRangeText('replacement', 0, 1, 'select');
