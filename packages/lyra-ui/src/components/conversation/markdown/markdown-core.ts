export * from './markdown-core.class.js';
export { loadMarkdownDeps as preloadMarkdown } from './markdown-loader.js';
export type { LyraMarkedParser } from './markdown-loader.js';
export { resolvedShikiLanguages, setShikiCoreEngine } from '../code-block/shiki-types.js';
export type {
  ShikiEngineOption,
  ShikiLanguageInput,
  ShikiLanguageLoader,
  ShikiLanguageSource,
  ShikiRegexEngine,
  ShikiRegexEngineFactory,
} from '../code-block/shiki-types.js';
import { LyraMarkdownCore } from './markdown-core.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('markdown-core', LyraMarkdownCore);
// policy-allow(component-dependency: lr-icon): Markdown's optional copy chrome uses the lean
// copy-button entry, whose icon-button renders supplied SVG glyphs and never requests lr-icon.
