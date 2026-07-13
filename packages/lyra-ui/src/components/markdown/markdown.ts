export * from './markdown.class.js';
import { LyraMarkdown } from './markdown.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('markdown', LyraMarkdown);
