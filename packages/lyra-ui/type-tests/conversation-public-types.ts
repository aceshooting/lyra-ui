import type {
  LyraMarkedParser as FullMarkedParser,
  MarkdownHeadingItem as FullHeadingItem,
  ShikiLanguageInput as FullLanguageInput,
} from '../src/components/conversation/markdown/markdown.js';
import type {
  LyraMarkedParser as CoreMarkedParser,
  MarkdownHeadingItem as CoreHeadingItem,
  ShikiLanguageInput as CoreLanguageInput,
} from '../src/components/conversation/markdown/markdown-core.js';
import type {
  ShikiLanguageInput as FullCodeBlockLanguageInput,
} from '../src/components/conversation/code-block/code-block.js';
import type {
  ShikiLanguageInput as CoreCodeBlockLanguageInput,
} from '../src/components/conversation/code-block/code-block-core.js';
import type {
  ShikiLanguageInput as ConversationLanguageInput,
} from '../src/components/conversation/index.js';
import type { ShikiLanguageInput as RootLanguageInput } from '../src/lyra.js';
import type {
  MessageFeedbackRating,
  MessageFeedbackValue,
} from '../src/components/conversation/message-feedback/message-feedback.js';
import type { LyraModelSelectSize } from '../src/components/conversation/model-select/model-select.js';
import type { LyraChatSuggestion as GranularChatSuggestion } from '../src/components/conversation/suggestion-chips/suggestion-chips.js';
import type { LyraChatSuggestion as RootChatSuggestion } from '../src/lyra.js';
// @ts-expect-error ChatSuggestion was replaced by the canonical LyraChatSuggestion in v9.
import type { ChatSuggestion as RemovedGranularChatSuggestion } from '../src/components/conversation/suggestion-chips/suggestion-chips.js';
// @ts-expect-error ChatSuggestion is not retained as a root compatibility alias.
import type { ChatSuggestion as RemovedRootChatSuggestion } from '../src/lyra.js';

const rootSuggestion: RootChatSuggestion = { suggestionId: 'inspect', label: 'Inspect', icon: '🔎' };
const granularSuggestion: GranularChatSuggestion = rootSuggestion;
declare const removedSuggestions: [RemovedGranularChatSuggestion, RemovedRootChatSuggestion];

const conversationPublicTypes: [
  FullMarkedParser,
  FullHeadingItem,
  FullLanguageInput,
  CoreMarkedParser,
  CoreHeadingItem,
  CoreLanguageInput,
  MessageFeedbackRating,
  MessageFeedbackValue,
  LyraModelSelectSize,
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
