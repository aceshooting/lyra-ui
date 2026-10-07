// Lean entry for a prompt input without model, voice, source or queue data.
// Import each corresponding child registration entry when supplying that data.
export * from './prompt-input.class.js';
import { LyraPromptInput } from './prompt-input.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/attachment-chip/attachment-chip.js';
import '../../media/attachment-trigger/attachment-trigger.js';
import '../../utility/mention-popover/mention-popover.js';
import '../chat-composer/chat-composer.js';

defineElement('prompt-input', LyraPromptInput);
