export * from './media/file-icon/file-icon.class.js';
export * from './media/file-icon/file-type-metadata.js';
import { LyraFileIcon } from './media/file-icon/file-icon.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('file-icon', LyraFileIcon);
