import type {
  LyraMarkedParser as FullMarkedParser,
  MarkdownHeadingItem as FullHeadingItem,
  ShikiLanguageInput as FullLanguageInput,
  } from '../src/components/lr-markdown.js';
import type {
  LyraMarkedParser as CoreMarkedParser,
  MarkdownHeadingItem as CoreHeadingItem,
  ShikiLanguageInput as CoreLanguageInput,
  } from '../src/components/lr-markdown-core.js';
import type {
  ShikiLanguageInput as FullCodeBlockLanguageInput,
  } from '../src/components/lr-code-block.js';
import type {
  ShikiLanguageInput as CoreCodeBlockLanguageInput,
  } from '../src/components/lr-code-block-core.js';
import type {
  ShikiLanguageInput as ConversationLanguageInput,
  } from '../src/components/conversation/index.js';
import type { ShikiLanguageInput as RootLanguageInput,
} from '../src/lyra.js';
import type {
  MessageFeedbackRating,
  MessageFeedbackValue,
  } from '../src/components/lr-message-feedback.js';
import type { LyraChatSuggestion as GranularChatSuggestion } from '../src/components/lr-suggestion-chips.js';
import type { LyraChatSuggestion as RootChatSuggestion,
} from '../src/lyra.js';
// @ts-expect-error LyraModelSelectSize was removed in favor of the shared LyraSize.
import type { LyraModelSelectSize as RemovedGranularModelSelectSize } from '../src/components/lr-model-select.js';

// @ts-expect-error LyraVoicePickerSize was removed in favor of the shared LyraSize.
import type { LyraVoicePickerSize as RemovedGranularVoicePickerSize } from '../src/components/lr-voice-picker.js';

// @ts-expect-error ChatSuggestion was replaced by LyraChatSuggestion.
import type { ChatSuggestion as RemovedGranularChatSuggestion } from '../src/components/lr-suggestion-chips.js';

// @ts-expect-error ChatSuggestion was replaced by LyraChatSuggestion at the curated root.
import type { ChatSuggestion as RemovedRootChatSuggestion } from '../src/lyra.js';

const rootSuggestion: RootChatSuggestion = { suggestionId: 'inspect', label: 'Inspect', icon: '🔎' };
const granularSuggestion: GranularChatSuggestion = rootSuggestion;
declare const removedSuggestions: [RemovedGranularChatSuggestion, RemovedRootChatSuggestion];
declare const removedSizeAliases: [RemovedGranularModelSelectSize, RemovedGranularVoicePickerSize];

const conversationPublicTypes: [
  FullMarkedParser,
  FullHeadingItem,
  FullLanguageInput,
  CoreMarkedParser,
  CoreHeadingItem,
  CoreLanguageInput,
  MessageFeedbackRating,
  MessageFeedbackValue,
] | undefined = undefined;

const codeBlockLanguageInput: FullCodeBlockLanguageInput = {
  name: 'json',
  scopeName: 'source.json',
};
const codeBlockPublicTypes: [
  CoreCodeBlockLanguageInput,
  ConversationLanguageInput,
  RootLanguageInput,
] = [codeBlockLanguageInput, codeBlockLanguageInput, codeBlockLanguageInput];

void conversationPublicTypes;
void codeBlockPublicTypes;
void granularSuggestion;
void removedSuggestions;
void removedSizeAliases;
