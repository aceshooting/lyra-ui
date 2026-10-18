import { LyraCodeBlock } from '../src/components/conversation/code-block/code-block.class.js';
import type { LyraMarkdown } from '../src/components/conversation/markdown/markdown.class.js';
import type { LyraDiffView } from '../src/components/utility/diff-view/diff-view.class.js';
import type { LyraStreamingText } from '../src/components/conversation/streaming-text/streaming-text.class.js';
import type { LyraStreamingTextCore } from '../src/components/conversation/streaming-text/streaming-text-core.class.js';
import type { ShikiLanguageInput, ShikiLanguageLoader } from '../src/components/conversation/code-block/shiki-types.js';

declare const components: readonly [LyraCodeBlock, LyraMarkdown, LyraDiffView, LyraStreamingText, LyraStreamingTextCore];
declare const grammar: ShikiLanguageInput;
declare const loader: ShikiLanguageLoader;

for (const component of components) {
  const concrete: Readonly<Record<string, ShikiLanguageInput>> | undefined = component.languages;
  void concrete;
  component.languages = { example: grammar };
  component.languageLoaders = { example: loader };
  component.languageLoaders = undefined;
  // @ts-expect-error concrete grammar readback remains compatible with existing consumers
  component.languages = { example: loader };
  // @ts-expect-error the opt-in map contains loaders, not concrete grammars
  component.languageLoaders = { example: grammar };
}

// Existing subclasses can read the protected concrete grammar without handling lazy functions.
class ConcreteGrammarConsumer extends LyraCodeBlock {
  readGrammar(): ShikiLanguageInput | undefined {
    return this.preSuppliedGrammar();
  }
}
void ConcreteGrammarConsumer;
