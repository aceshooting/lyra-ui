export * from './conversation/prompt-queue/prompt-queue.class.js';
import './lr-button.js';
import './lr-textarea.js';
import { defineElement } from '../internal/prefix.js';
import { LyraPromptQueue } from './conversation/prompt-queue/prompt-queue.class.js';

defineElement('prompt-queue', LyraPromptQueue);
