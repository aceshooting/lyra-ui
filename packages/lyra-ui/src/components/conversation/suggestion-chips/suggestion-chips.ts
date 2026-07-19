export * from './suggestion-chips.class.js';
import { LyraSuggestionChips } from './suggestion-chips.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/scroller/scroller.js';
defineElement('suggestion-chips', LyraSuggestionChips);
