export type { LyraTimestamp } from './conversation/timestamp.js';
export * from './conversation/chat-message/chat-message.class.js';
import { LyraChatMessage } from './conversation/chat-message/chat-message.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('chat-message', LyraChatMessage);
