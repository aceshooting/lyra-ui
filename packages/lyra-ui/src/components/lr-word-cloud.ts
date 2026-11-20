export * from './data/word-cloud/word-cloud.class.js';
import { LyraWordCloud } from './data/word-cloud/word-cloud.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('word-cloud', LyraWordCloud);
