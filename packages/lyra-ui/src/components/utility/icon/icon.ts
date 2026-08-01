export * from './icon.class.js';
export * from './icon-library.js';
import { LyraIcon } from './icon.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('icon', LyraIcon);
