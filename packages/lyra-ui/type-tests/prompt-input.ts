import type {
  ChatComposerSelectionDirection,
  ChatComposerWrap,
  LyraPromptInput,
  LyraPromptInputAttachment,
} from '../src/lyra.js';

declare const promptInput: LyraPromptInput;

const input: HTMLTextAreaElement | null = promptInput.input;
const direction: ChatComposerSelectionDirection | null = promptInput.selectionDirection;
const wrap: ChatComposerWrap = promptInput.wrap;
void input;
void direction;
void wrap;

const attachment: LyraPromptInputAttachment = { attachmentId: 'report', name: 'report.pdf', bytes: 2_048 };
promptInput.attachments = [attachment];
// @ts-expect-error LyraPromptInputAttachment uses the child chip's `bytes` vocabulary, not `size`.
promptInput.attachments = [{ attachmentId: 'legacy', name: 'legacy.pdf', size: 2_048 }];
// @ts-expect-error v9 attachment identity is `attachmentId`, not the generic `id` field.
promptInput.attachments = [{ id: 'legacy', name: 'legacy.pdf' }];

promptInput.spellcheck = false;
promptInput.autocapitalize = 'sentences';
promptInput.autocorrect = 'on';
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
