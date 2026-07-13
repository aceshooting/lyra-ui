export * from './chat-composer.class.js';
import { LyraChatComposer } from './chat-composer.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('chat-composer', LyraChatComposer);
