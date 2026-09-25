export * from './markdown.class.js';
export { loadMarkdownDeps as preloadMarkdown } from './markdown-loader.js';
export type { LyraMarkedParser } from './markdown-loader.js';
export type { ShikiLanguageInput } from '../code-block/shiki-types.js';
import { LyraMarkdown } from './markdown.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('markdown', LyraMarkdown);
// policy-allow(component-dependency: lr-icon): Markdown's optional copy chrome uses the lean
// copy-button entry, whose icon-button renders supplied SVG glyphs and never requests lr-icon.
