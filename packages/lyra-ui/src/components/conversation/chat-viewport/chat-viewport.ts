/** @deprecated Import @aceshooting/lyra-ui/components/lr-chat-viewport.js to register this component. */
export * from './chat-viewport.class.js';
import { LyraChatViewport } from './chat-viewport.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('chat-viewport', LyraChatViewport);
