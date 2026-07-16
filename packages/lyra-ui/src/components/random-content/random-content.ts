export * from './random-content.class.js';
import { LyraRandomContent } from './random-content.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('random-content', LyraRandomContent);
