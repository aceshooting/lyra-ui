import type { LyraMarkdownCore } from '../src/lyra.js';

declare const markdownCore: LyraMarkdownCore;

markdownCore.renderMarkdown();
const parser = markdownCore.marked;
parser?.use({ hooks: { preprocess: (source: string) => source } });

// The parser instance is configurable, but the component's getter itself is readonly.
// @ts-expect-error `marked` has no public setter.
markdownCore.marked = undefined;
