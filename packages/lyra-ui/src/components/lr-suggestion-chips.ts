export * from './conversation/suggestion-chips/suggestion-chips.class.js';
import { LyraSuggestionChips } from './conversation/suggestion-chips/suggestion-chips.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-scroller.js';
import './lr-icon.js';
defineElement('suggestion-chips', LyraSuggestionChips);
