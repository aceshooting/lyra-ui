export * from './markdown.class.js';
export type { LyraMarkedParser } from './markdown-loader.js';
export type { ShikiLanguageInput } from '../code-block/shiki-types.js';
import { LyraMarkdown } from './markdown.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('markdown', LyraMarkdown);
