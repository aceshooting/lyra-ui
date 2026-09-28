/** @deprecated Import @aceshooting/lyra-ui/components/lr-textarea.js to register this component. */
export * from './textarea.class.js';
import { LyraTextarea } from './textarea.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('textarea', LyraTextarea);
