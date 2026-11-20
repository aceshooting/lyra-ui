export * from './conversation/typing-indicator/typing-indicator.class.js';
import { LyraTypingIndicator } from './conversation/typing-indicator/typing-indicator.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('typing-indicator', LyraTypingIndicator);
