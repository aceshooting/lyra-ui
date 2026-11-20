export * from './conversation/chat-composer/chat-composer.class.js';
import { LyraChatComposer } from './conversation/chat-composer/chat-composer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('chat-composer', LyraChatComposer);
