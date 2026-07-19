export * from './file-icon.class.js';
export * from './file-type-metadata.js';
import { LyraFileIcon } from './file-icon.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('file-icon', LyraFileIcon);
