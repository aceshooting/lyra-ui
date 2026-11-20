// Lean entry for a prompt input without model, voice, source or queue data.
// Import each corresponding child registration entry when supplying that data.
export * from './prompt-input.class.js';
import { LyraPromptInput } from './prompt-input.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../lr-attachment-chip.js';
import '../../lr-attachment-trigger.js';
import '../../lr-mention-popover.js';
import '../../lr-chat-composer.js';

defineElement('prompt-input', LyraPromptInput);
