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
