export * from './word-cloud.class.js';
import { LyraWordCloud } from './word-cloud.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('word-cloud', LyraWordCloud);
