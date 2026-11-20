export * from './utility/random-content/random-content.class.js';
import { LyraRandomContent } from './utility/random-content/random-content.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('random-content', LyraRandomContent);
