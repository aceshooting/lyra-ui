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
import type { ChatSuggestion as GranularChatSuggestion } from '../src/components/conversation/suggestion-chips/suggestion-chips.js';
import type { ChatSuggestion as RootChatSuggestion } from '../src/lyra.js';

const rootSuggestion: RootChatSuggestion = { id: 'inspect', label: 'Inspect', icon: '🔎' };
const granularSuggestion: GranularChatSuggestion = rootSuggestion;

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
