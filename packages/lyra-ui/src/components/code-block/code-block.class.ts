import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon } from '../../internal/icons.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import {
  loadShikiHighlighter,
  loadShikiLanguage,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  SHIKI_THEMES,
  type ShikiHighlighter,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from './code-loader.js';
import { styles } from './code-block.styles.js';
import { codeBlockToggleLabel, codeBlockCopyLabel, codeBlockBodyLabel } from './code-block-shared.js';
import '../skeleton/skeleton.class.js';

/** How long the copy button's confirmation state lasts before reverting. */
const COPY_CONFIRM_MS = 1500;

/**
 * Rewrites shiki's generated `<pre>`/`<code>` hast nodes so they carry this
 * component's own `part="pre"`/`part="code"` hooks — the same single-pass
 * "inject part attributes while rendering, not a second DOM walk after
 * insertion" approach `<lyra-markdown>`'s renderer override uses, applied
 * here via shiki's own transformer API instead of a custom marked renderer.
 * Also strips shiki's own default `tabindex="0"` from the `<pre>` — this
 * component's `[part="body"]` wrapper (see `render()`) is the single
 * scrollable/focusable region for the code area, and leaving shiki's own
 * tabindex in place would add a second, redundant tab stop over the same
 * scrollable content.
 */
function partTransformer(lineNumbers: boolean) {
  return {
  name: 'lyra-code-block-parts',
    pre(node: OptionalPeerApi) {
      node.properties.part = ['pre'];
      if (lineNumbers) {
        const classes = Array.isArray(node.properties.class)
          ? node.properties.class
          : node.properties.class
            ? [node.properties.class]
            : [];
        node.properties.class = [...classes, 'line-numbers'];
      }
      delete node.properties.tabindex;
    },
    code(node: OptionalPeerApi) {
      node.properties.part = ['code'];
    },
  };
}

export interface LyraCodeBlockEventMap {
  'lyra-copy': CustomEvent<{ text: string }>;
  'lyra-toggle': CustomEvent<{ collapsed: boolean }>;
}
/**
 * `<lyra-code-block>` — fenced code display with optional lazy syntax
 * highlighting and a copy button. No highlighting grammar ships in this
 * component itself: it lazy-loads the optional peer dependency `shiki` (see
 * `code-loader.ts`) for the actual tokenizing, and degrades to a plain
 * `<pre><code>` when that peer isn't installed or `language` is unset/
 * unrecognized — the exact same optional-peer shape `<lyra-markdown>` and
 * `<lyra-chart>` already establish. That fallback is the *default* rendering
 * path, not a degraded one: unhighlighted code is perfectly usable, and it's
 * what every instance renders at zero extra bytes until shiki resolves.
 *
 * A `<lyra-skeleton>` placeholder stands in only while shiki itself is
 * loading for the very first time on the page (cached — see
 * `loadShikiHighlighter()`) and `language` is set. It's deliberately *not*
 * shown again for a subsequent per-language grammar load (e.g. a second
 * `<lyra-code-block>` requesting a language no earlier instance has used
 * yet) — that grammar fetch is typically fast, and the plain-text fallback
 * is already a perfectly readable placeholder for it, so a second
 * loading-chrome state would add complexity for little practical benefit.
 *
 * Set a host `aria-label` (or the matching `accessibleLabel` property) to
 * override the filename/language-derived name on the internal focusable code
 * region. The name is forwarded to the element that owns `role="group"`, not
 * left only on the custom-element host across the shadow boundary.
 *
 * `languages` is an additive, opt-in escape hatch from that default path for
 * a consumer whose language set is fixed and known ahead of time: a map of
 * language id to an already-imported shiki grammar module (e.g. `import bash
 * from 'shiki/langs/bash.mjs'`). When `language` matches a key in `languages`,
 * this component seeds a fine-grained `createHighlighterCore()` highlighter
 * with *only* the pre-supplied grammars (see `code-loader.ts`'s
 * `loadShikiHighlighterCore()`) instead of waiting on `loadShikiHighlighter()`
 * and its dynamic per-language `loadLanguage()` import. The payoff isn't
 * runtime cost — the default dynamic-import path is already well-optimized
 * for that — it's *build output*: shiki's main entry point bundles a dynamic
 * `import()` per bundled language (~200 of them) because a bundler can't
 * statically narrow which of those a `loadLanguage(lang: string)` call might
 * request at runtime, so it conservatively emits a build-output chunk for
 * every one of them. `shiki/core`'s fine-grained API has no such table — a
 * bundler only ever sees the exact grammar modules `languages` itself
 * `import`s, so a consumer who pins its full language set this way trades a
 * hand-maintained list for a build output scoped to just those languages
 * instead of shiki's entire bundled set. A language requested but absent
 * from `languages` still falls back to the ordinary dynamic-import path
 * unchanged, so this is a partial opt-in, not a replacement for it.
 *
 * @customElement lyra-code-block
 * @event lyra-copy - The copy button was activated. `detail: { text }` is
 *   always the raw `code` value (never the highlighted HTML), and always
 *   fires regardless of whether the actual OS clipboard write succeeded —
 *   same convention as `<lyra-json-viewer>`'s own copy button.
 * @event lyra-toggle - The collapse/expand header button was activated.
 *   `detail: { collapsed }` — same event name and shape convention as
 *   `<lyra-thinking-panel>`'s own `lyra-toggle`.
 * @csspart base - The outer container.
 * @csspart header - The row above the code (filename/language/copy/toggle),
 *   present whenever there's anything to put in it.
 * @csspart filename - The `filename` text, when set.
 * @csspart language - The `language` badge, when set, so the language is
 *   exposed to assistive tech as visible text rather than only a `language`
 *   attribute a screen reader would never announce.
 * @csspart copy-button - The copy-to-clipboard button, when `copyable`.
 * @csspart toggle - The collapse/expand chevron button, when `collapsible`.
 * @csspart body - The scrollable region wrapping the code (or the loading
 *   skeleton); respects `max-height`, `hidden` while `collapsible` and
 *   `collapsed`.
 * @csspart pre - The rendered `<pre>` — shiki's own in the highlighted path,
 *   this component's own plain one in the fallback path.
 * @csspart code - The rendered `<code>`, same split as `pre` above.
 */
export class LyraCodeBlock extends LyraElement<LyraCodeBlockEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The raw source text. */
  @property() code = '';

  /** A shiki-recognized language id or alias (e.g. `"javascript"`,
   *  `"python"`, `"json"`). When unset, or when shiki doesn't recognize it,
   *  the code renders as plain unhighlighted text regardless of whether
   *  shiki itself is available. */
  @property() language = '';

  /** Shown in the header above the code, when set. */
  @property() filename = '';

  /** Accessible-name override for the internal focusable code region. Maps
   *  to the host's `aria-label` attribute and wins over `filename` and
   *  `language`-derived defaults. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** Whether the code region can be collapsed via a header toggle. */
  @property({ type: Boolean, reflect: true }) collapsible = false;

  /** Whether the code region is currently hidden. Only has a visible effect
   *  while `collapsible` is also true. */
  @property({ type: Boolean, reflect: true }) collapsed = false;

  /** Shows a copy-to-clipboard button in the header. */
  @property({ type: Boolean, reflect: true }) copyable = true;

  /** A CSS length (e.g. `"20rem"`); once set, the code scrolls internally
   *  past this height instead of growing the page. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Whether to display one-based line numbers beside the code. */
  @property({ type: Boolean, attribute: 'line-numbers', reflect: true }) lineNumbers = false;

  /** A map of language id to an already-imported shiki grammar module's
   *  default export (e.g. `{ bash: bashGrammar }` where `bashGrammar` came
   *  from a module-scope `import bash from 'shiki/langs/bash.mjs'`). When
   *  `language` matches a key here, highlighting for it is seeded from
   *  exactly this pre-supplied grammar via a fine-grained
   *  `createHighlighterCore()` highlighter, bypassing the default
   *  `loadShikiHighlighter()` singleton and its dynamic per-language
   *  `loadLanguage()` import entirely for that language — see the class doc
   *  above for the build-output rationale. A `language` value absent from
   *  this map (or left unset, or when `languages` itself is unset) falls
   *  back to that default dynamic-import path unchanged. */
  @property({ attribute: false }) languages?: Record<string, ShikiLanguageInput>;

  /** When `true`, skips the default `loadShikiHighlighter()` call in `connectedCallback()`
   *  entirely — for a consumer whose `languages` map already covers every language every instance
   *  will ever render, so the bundler has no reachable path from this component to shiki's
   *  ~200-language dynamic-import table. A `language` value absent from `languages` while this is
   *  `true` renders the plain-text fallback (no attempt to fall back to the now-unloaded default
   *  highlighter) rather than hanging. `false` (the default) reproduces today's unconditional
   *  `loadShikiHighlighter()` call exactly. */
  @property({ type: Boolean, attribute: 'languages-only' }) languagesOnly = false;

  // `null` covers every reason the plain-text fallback is showing: shiki
  // isn't installed, `language` is unset, or `language` isn't shiki-
  // recognized -- `render()` doesn't need to (and can't usefully) tell these
  // apart, same rationale as <lyra-markdown>'s identically-shaped field.
  @state() private highlightedHtml: string | null = null;

  // Becomes true once the shared shiki-loading promise has settled, whether
  // or not it actually resolved to a highlighter -- gates the skeleton (see
  // the class doc's second paragraph), not the highlighting itself.
  @state() private shikiReady = false;

  @state() private justCopied = false;

  private highlighter?: ShikiHighlighter | null;

  // Guards the async per-language load in syncHighlight() against a
  // `code`/`language` change that arrives before a previous load resolves --
  // only the result matching the *current* token is ever applied.
  private highlightToken = 0;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  private readonly bodyId = nextId('code-block-body');

  connectedCallback(): void {
    super.connectedCallback();
    if (this.languagesOnly) return;
    void loadShikiHighlighter().then((hl) => {
      this.highlighter = hl;
      this.shikiReady = true;
      this.syncHighlight();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
  }

  // The `languages` entry for the *current* `language`, if any -- shared by
  // `willUpdate()`/`updated()`/`render()`/`syncHighlight()` so they all agree
  // on whether this render is taking the fine-grained `languages` path or
  // the default `loadShikiHighlighter()` one.
  private preSuppliedGrammar(): ShikiLanguageInput | undefined {
    const language = normalizeShikiLanguage(this.language);
    return this.languages?.[language] ?? this.languages?.[this.language];
  }

  // Mutating `highlightedHtml` here (rather than in `updated()`) absorbs the
  // synchronous case -- language already loaded, see `syncHighlight()` --
  // into this same update cycle instead of scheduling a second one, Lit's
  // documented pattern for deriving one reactive property from a change to
  // others (same approach <lyra-markdown>'s `willUpdate` takes).
  protected willUpdate(changed: PropertyValues): void {
    if (!(changed.has('code') || changed.has('language') || changed.has('languages'))) return;
    // The default path still waits on `shikiReady` (the shared
    // `loadShikiHighlighter()` singleton), same as always. A `language`
    // covered by `languages` doesn't need that singleton at all, so it can
    // sync as soon as the relevant property actually changes, instead of
    // waiting on an unrelated (and, for a `languages`-only consumer,
    // possibly never-needed) full-bundle load to finish first.
    if (this.shikiReady || this.preSuppliedGrammar()) {
      this.syncHighlight();
    }
  }

  protected updated(): void {
    // `languagesOnly` skips the default loader entirely (see connectedCallback()), so
    // `shikiReady` never becomes true for it -- treat that as "nothing to wait for" rather than
    // "still loading", the same way a `preSuppliedGrammar()` match already does.
    const showingSkeleton = !this.shikiReady && !this.languagesOnly && !!this.language && !this.preSuppliedGrammar();
    if (showingSkeleton) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
  }

  private syncHighlight(): void {
    // Bumped unconditionally -- on *every* call, not just the async branch
    // below -- so that a call landing on the synchronous already-loaded
    // branch still invalidates any earlier in-flight load from a previous
    // call. Without this, a load kicked off by an older call can resolve
    // after a newer call has already rendered correct synchronous output,
    // and overwrite it with stale tokenization.
    const token = ++this.highlightToken;
    const lang = normalizeShikiLanguage(this.language);
    if (!lang) {
      this.highlightedHtml = null;
      return;
    }

    const languages = this.languages;
    if (languages?.[lang] ?? languages?.[this.language]) {
      // Fine-grained opt-in path -- entirely separate from `this.highlighter`
      // below, see `loadShikiHighlighterCore()`'s doc comment for why.
      this.highlightedHtml = null;
      void loadShikiHighlighterCore(languages).then((hl) => {
        if (token !== this.highlightToken) return; // superseded by a newer code/language/languages change
        this.highlightedHtml = hl ? this.tokenize(hl, lang) : null;
      });
      return;
    }

    const hl = this.highlighter;
    if (!hl) {
      this.highlightedHtml = null;
      return;
    }
    if (hl.getLoadedLanguages().includes(lang)) {
      this.highlightedHtml = this.tokenize(hl, lang);
      return;
    }
    // Grammar not loaded yet -- show the plain-text fallback in the
    // meantime rather than leaving a *previous* code/language value's stale
    // highlighted markup on screen while this one loads.
    this.highlightedHtml = null;
    void loadShikiLanguage(hl, lang).then((ok) => {
      if (token !== this.highlightToken) return; // superseded by a newer code/language change
      this.highlightedHtml = ok ? this.tokenize(hl, lang) : null;
    });
  }

  private tokenize(hl: ShikiHighlighter | ShikiHighlighterCore, lang: string): string | null {
    try {
      return hl.codeToHtml(this.code, {
        lang,
        // shiki's generated per-token colors are theme-specific inline
        // styles/CSS variables (from SHIKI_THEMES's github-light/github-dark
        // theme data), not this library's --lyra-* design tokens -- the one
        // deliberate exception to every other color in this component being
        // a --lyra-* token. See the dark-mode override in
        // code-block.styles.ts for how the dark half of this activates.
        themes: SHIKI_THEMES,
        transformers: [partTransformer(this.lineNumbers)],
      });
    } catch {
      // Malformed input for this grammar, or any other shiki-internal
      // failure -- fall back to plain text rather than a blank code block.
      return null;
    }
  }

  private renderPlainCode(): TemplateResult {
    if (!this.lineNumbers) return html`<code part="code">${this.code}</code>`;
    return html`
      <code part="code" class="line-numbered-code">
        ${this.code.split(/\r\n|\r|\n/).map((line) => html`<span class="line">${line}</span>`)}
      </code>
    `;
  }

  private writeClipboard(text: string): void {
    try {
      // navigator.clipboard is absent in insecure contexts / older browsers,
      // and some engines throw synchronously rather than rejecting -- either
      // way this is best-effort; copy() below always emits lyra-copy
      // regardless of whether the OS clipboard was actually reached. Same
      // precedent as <lyra-json-viewer>'s own copy button.
      void navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // see above
    }
  }

  private copy = (): void => {
    this.writeClipboard(this.code);
    this.emit('lyra-copy', { text: this.code });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, COPY_CONFIRM_MS);
  };

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit<{ collapsed: boolean }>('lyra-toggle', { collapsed: this.collapsed });
  };

  private renderHeader(): TemplateResult {
    return html`
      <div part="header">
        ${this.collapsible
          ? html`
              <button
                part="toggle"
                type="button"
                aria-expanded=${this.collapsed ? 'false' : 'true'}
                aria-controls=${this.bodyId}
                aria-label=${codeBlockToggleLabel(this.localize.bind(this), this.collapsed)}
                @click=${this.toggleCollapsed}
              >
                <span class="chevron" aria-hidden="true">${chevronIcon()}</span>
              </button>
            `
          : nothing}
        ${this.filename ? html`<span part="filename">${this.filename}</span>` : nothing}
        ${this.language ? html`<span part="language">${this.language}</span>` : nothing}
        ${this.copyable
          ? html`
              <button
                part="copy-button"
                type="button"
                aria-label=${codeBlockCopyLabel(this.localize.bind(this), this.justCopied)}
                @click=${this.copy}
              >
                ${this.justCopied ? this.localize('copied') : this.localize('copy')}
              </button>
            `
          : nothing}
      </div>
    `;
  }

  // `[part="body"]` is `tabindex="0"` because it's the scrollable region for
  // arbitrarily-wide/tall code (max-height, plus horizontal overflow from
  // long lines) -- a scrollable region with no other focusable content of
  // its own is otherwise unreachable by keyboard, same reasoning
  // lyra-virtual-list's own `[part="base"]` documents for its identical
  // tabindex. `role="group"` (rather than e.g. `region`, a page landmark
  // role) plus `aria-label` gives it an accessible name without claiming
  // landmark/navigation significance for what is, structurally, just one
  // small piece of a larger document.
  render(): TemplateResult {
    const hasHeader = !!this.filename || !!this.language || this.copyable || this.collapsible;
    // See updated()'s identical condition for why languagesOnly is excluded here too.
    const showSkeleton = !this.shikiReady && !this.languagesOnly && !!this.language && !this.preSuppliedGrammar();
    const bodyHidden = this.collapsible && this.collapsed;
    const bodyLabel =
      this.accessibleLabel || codeBlockBodyLabel(this.localize.bind(this), this.filename, this.language);

    return html`
      <div part="base">
        ${hasHeader ? this.renderHeader() : nothing}
        <div
          part="body"
          id=${this.bodyId}
          role="group"
          aria-label=${bodyLabel}
          tabindex="0"
          ?hidden=${bodyHidden}
          style=${this.maxHeight ? `--lyra-code-block-max-height:${this.maxHeight}` : nothing}
        >
          ${showSkeleton
            ? html`<lyra-skeleton variant="rect"></lyra-skeleton>`
            : this.highlightedHtml !== null
              ? unsafeHTML(this.highlightedHtml)
              : html`<pre part="pre" class=${this.lineNumbers ? 'line-numbers' : nothing}>${this.renderPlainCode()}</pre>`}
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-code-block': LyraCodeBlock;
  }
}
