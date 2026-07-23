export * from './prompt-queue.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraPromptQueue } from './prompt-queue.class.js';

defineElement('prompt-queue', LyraPromptQueue);
