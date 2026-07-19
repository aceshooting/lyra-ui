export * from './message-actions.class.js';
import { LyraMessageActions } from './message-actions.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/copy-button/copy-button.js';
import '../message-feedback/message-feedback.js';
defineElement('message-actions', LyraMessageActions);
