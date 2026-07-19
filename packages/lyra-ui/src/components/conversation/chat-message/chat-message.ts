export * from './chat-message.class.js';
import { LyraChatMessage } from './chat-message.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../utility/live-region/live-region.js";
defineElement('chat-message', LyraChatMessage);
