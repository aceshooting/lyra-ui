export * from './agent-tools/prompt-studio/prompt-studio.class.js';
import { LyraPromptStudio } from './agent-tools/prompt-studio/prompt-studio.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('prompt-studio', LyraPromptStudio);

