// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export type { ChatComposerActionsLayout, ChatComposerFrame, ChatComposerSelectionDirection, ChatComposerToolbarAlign, ChatComposerToolbarPlacement, ChatComposerWrap } from './conversation/chat-composer/chat-composer.class.js';
export type { LyraModelCatalogEntry } from './conversation/model-select/model-select.class.js';
export type { PromptQueueChangeDetail } from './conversation/prompt-queue/prompt-queue.class.js';
export type { LyraAttachmentIdDetail, LyraAttachmentPreviewRequestDetail, LyraAttachmentUploadStatus } from './media/attachment-chip/attachment-chip.class.js';
export type { LyraAttachmentCapability, LyraAttachmentFilesDetail } from './media/attachment-trigger/attachment-trigger.class.js';
export type { LyraMentionItem } from './utility/mention-popover/mention-popover.class.js';
export type { LyraCatalog, LyraCatalogEntry } from '../internal/catalog-picker.js';
export type { ChatComposerStatus } from '../internal/chat-composer-status.js';
export * from './conversation/prompt-input/prompt-input.class.js';
import './lr-attachment-chip.js';
import './lr-attachment-trigger.js';
import './lr-mention-popover.js';
import './lr-chat-composer.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
import { LyraPromptInput } from './conversation/prompt-input/prompt-input.class.js';

// The model, voice and source pickers and the queue register the first time their data is set.
defineLazyChildren('prompt-input', {
  'model-select': () => import('./lr-model-select.js'),
  'voice-picker': () => import('./lr-voice-picker.js'),
  'source-picker': () => import('./lr-source-picker.js'),
  'prompt-queue': () => import('./lr-prompt-queue.js'),
});
defineElement('prompt-input', LyraPromptInput);
