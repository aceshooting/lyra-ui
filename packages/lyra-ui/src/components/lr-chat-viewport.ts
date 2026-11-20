export * from './conversation/chat-viewport/chat-viewport.class.js';
import { LyraChatViewport } from './conversation/chat-viewport/chat-viewport.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('chat-viewport', LyraChatViewport);
