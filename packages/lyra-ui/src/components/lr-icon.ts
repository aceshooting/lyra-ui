export * from './utility/icon/icon.class.js';
export * from './utility/icon/icon-library.js';
import { LyraIcon } from './utility/icon/icon.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('icon', LyraIcon);
