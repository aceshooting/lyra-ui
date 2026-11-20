export * from './conversation/message-feedback/message-feedback.class.js';
import { LyraMessageFeedback } from './conversation/message-feedback/message-feedback.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('message-feedback', LyraMessageFeedback);
