export * from './conversation/markdown/markdown-core.class.js';
export { loadMarkdownDeps as preloadMarkdown } from './conversation/markdown/markdown-loader.js';
export type { LyraMarkedParser } from './conversation/markdown/markdown-loader.js';
export { resolvedShikiLanguages, setShikiCoreEngine } from './conversation/code-block/shiki-types.js';
export type {
  ShikiEngineOption,
  ShikiLanguageInput,
  ShikiLanguageLoader,
  ShikiLanguageSource,
  ShikiRegexEngine,
  ShikiRegexEngineFactory,
} from './conversation/code-block/shiki-types.js';
import { LyraMarkdownCore } from './conversation/markdown/markdown-core.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('markdown-core', LyraMarkdownCore);
