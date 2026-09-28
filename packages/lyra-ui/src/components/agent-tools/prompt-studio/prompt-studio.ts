/** @deprecated Import @aceshooting/lyra-ui/components/lr-prompt-studio.js to register this component. */
export * from './prompt-studio.class.js';
import { LyraPromptStudio } from './prompt-studio.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('prompt-studio', LyraPromptStudio);

