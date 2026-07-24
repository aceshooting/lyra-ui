export * from './prompt-queue.class.js';
import '../../forms/button/button.js';
import '../../forms/textarea/textarea.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraPromptQueue } from './prompt-queue.class.js';

defineElement('prompt-queue', LyraPromptQueue);
