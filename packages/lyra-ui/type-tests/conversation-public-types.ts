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

void conversationPublicTypes;
void granularSuggestion;
