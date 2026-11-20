export * from './conversation/markdown/markdown.class.js';
export { loadMarkdownDeps as preloadMarkdown } from './conversation/markdown/markdown-loader.js';
export type { LyraMarkedParser } from './conversation/markdown/markdown-loader.js';
export type { ShikiLanguageInput } from './conversation/code-block/shiki-types.js';
import { LyraMarkdown } from './conversation/markdown/markdown.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('markdown', LyraMarkdown);
