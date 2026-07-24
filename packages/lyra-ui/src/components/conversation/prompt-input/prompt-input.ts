export * from './prompt-input.class.js';
import '../../media/attachment-chip/attachment-chip.js';
import '../../media/attachment-trigger/attachment-trigger.js';
import '../../retrieval/source-picker/source-picker.js';
import '../../utility/mention-popover/mention-popover.js';
import '../chat-composer/chat-composer.js';
import '../model-select/model-select.js';
import '../prompt-queue/prompt-queue.js';
import '../voice-picker/voice-picker.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraPromptInput } from './prompt-input.class.js';

defineElement('prompt-input', LyraPromptInput);
