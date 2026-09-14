// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
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
