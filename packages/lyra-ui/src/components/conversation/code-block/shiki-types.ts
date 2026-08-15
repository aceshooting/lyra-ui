/**
 * The peer-neutral highlighter capability used by Lyra's code-rendering components.
 *
 * This deliberately describes only the operations Lyra invokes. It keeps public declarations
 * useful without requiring consumers to install Shiki merely to type-check an element reference.
 */
export interface ShikiHighlighter {
  codeToHtml(code: string, options: Record<string, unknown>): string;
  getLoadedLanguages(): string[];
  loadLanguage(language: string | ShikiLanguageInput): Promise<void>;
}

/**
 * A fine-grained Shiki highlighter has the same capability surface Lyra consumes as the default
 * highlighter, but is constructed from application-supplied grammars.
 */
export type ShikiHighlighterCore = ShikiHighlighter;

/** The peer-neutral shape of a pre-imported TextMate grammar module's default export. */
export interface ShikiLanguageInput {
  name: string;
  scopeName: string;
  displayName?: string;
  aliases?: string[];
  patterns?: unknown[];
  repository?: Record<string, unknown>;
}

/** The subset of a Shiki/HAST element node that Lyra's transformers mutate. */
export interface ShikiTransformerNode {
  properties: Record<string, unknown> & {
    part?: unknown;
    role?: unknown;
  };
}

/**
 * The peer-neutral transformer hooks used by Lyra's code and Markdown renderers.
 * Consumers do not need Shiki installed merely to consume the generated declarations.
 */
export interface ShikiTransformer {
  name?: string;
  pre?(node: ShikiTransformerNode): void;
  code?(node: ShikiTransformerNode): void;
  line?(node: ShikiTransformerNode, line: number): void;
}

// Peer-neutral values shared by the full and fine-grained loaders. This module must never import
// Shiki's main entry: lean component entry points depend on it and promise not to reach the full
// language table.
export const SHIKI_LIGHT_THEME: string = 'github-light';
export const SHIKI_DARK_THEME: string = 'github-dark';

/** Passed directly as `codeToHtml()`'s dual-theme option. */
export const SHIKI_THEMES: Record<'light' | 'dark', string> = {
  light: SHIKI_LIGHT_THEME,
  dark: SHIKI_DARK_THEME,
};

/** Normalizes ids supplied by filename-oriented integrations and templates. */
export function normalizeShikiLanguage(lang: string): string {
  return lang.trim().toLowerCase().replace(/^\./, '');
}

/** One cached fine-grained highlighter promise per distinct `languages` object identity. */
const highlighterCores = new WeakMap<
  Record<string, ShikiLanguageInput>,
  Promise<ShikiHighlighterCore | null>
>();

type ShikiHighlighterCoreLoader = (
  languages: Record<string, ShikiLanguageInput>
) => Promise<ShikiHighlighterCore | null>;
let highlighterCoreLoaderForTesting: ShikiHighlighterCoreLoader | undefined;

/** @internal Replaces the fine-grained loader for deterministic async-generation tests. */
export function __setShikiHighlighterCoreLoaderForTesting(
  loader: ShikiHighlighterCoreLoader | undefined
): void {
  highlighterCoreLoaderForTesting = loader;
}

/**
 * Builds and caches a fine-grained `HighlighterCore` seeded with only the supplied grammars.
 * Only Shiki subpaths are imported here; the package's main entry and full grammar table remain
 * unreachable from lean component graphs.
 */
export function loadShikiHighlighterCore(
  languages: Record<string, ShikiLanguageInput>
): Promise<ShikiHighlighterCore | null> {
  if (highlighterCoreLoaderForTesting)
    return highlighterCoreLoaderForTesting(languages);
  let cached = highlighterCores.get(languages);
  if (!cached) {
    cached = Promise.all([
      import('shiki/core'),
      import('shiki/engine/oniguruma'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ])
      .then(
        ([{ createHighlighterCore }, { createOnigurumaEngine }, light, dark]) =>
          createHighlighterCore({
            themes: [light.default, dark.default],
            langs: Object.values(languages) as never,
            engine: createOnigurumaEngine(import('shiki/wasm')),
          }) as unknown as ShikiHighlighterCore
      )
      .catch((err) => {
        console.warn(
          "<lr-code-block>'s `languages` property failed to build a fine-grained shiki highlighter — " +
            'falling back to plain unhighlighted text for the languages it covers:',
          err
        );
        return null;
      });
    highlighterCores.set(languages, cached);
  }
  return cached;
}
