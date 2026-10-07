/** @deprecated Import @aceshooting/lyra-ui/components/lr-chat-message.js to register this component. */
export * from './chat-message.class.js';
import { LyraChatMessage } from './chat-message.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('chat-message', LyraChatMessage);
