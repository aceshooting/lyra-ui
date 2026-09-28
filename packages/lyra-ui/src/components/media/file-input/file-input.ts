/** @deprecated Import @aceshooting/lyra-ui/components/lr-file-input.js to register this component. */
export * from './file-input.class.js';
import { LyraFileInput } from './file-input.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('file-input', LyraFileInput);
