import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { ShikiTransformer } from 'shiki';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon } from '../../internal/icons.js';
import { loadShikiHighlighter, loadShikiLanguage, SHIKI_THEMES, type ShikiHighlighter } from './code-loader.js';
import { styles } from './code-block.styles.js';
import '../skeleton/skeleton.js';

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
const partTransformer: ShikiTransformer = {
  name: 'lyra-code-block-parts',
  pre(node) {
    node.properties.part = ['pre'];
    delete node.properties.tabindex;
  },
  code(node) {
    node.properties.part = ['code'];
  },
};

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
 * @customElement lyra-code-block
 * @event lyra-copy - The copy button was activated. `detail: { text }` is
 *   always the raw `code` value (never the highlighted HTML), and always
 *   fires regardless of whether the actual OS clipboard write succeeded —
 *   same convention as `<lyra-json-viewer>`'s own copy button.
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
export class LyraCodeBlock extends LyraElement {
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

  // Mutating `highlightedHtml` here (rather than in `updated()`) absorbs the
  // synchronous case -- language already loaded, see `syncHighlight()` --
  // into this same update cycle instead of scheduling a second one, Lit's
  // documented pattern for deriving one reactive property from a change to
  // others (same approach <lyra-markdown>'s `willUpdate` takes).
  protected willUpdate(changed: PropertyValues): void {
    if (this.shikiReady && (changed.has('code') || changed.has('language'))) {
      this.syncHighlight();
    }
  }

  protected updated(): void {
    const showingSkeleton = !this.shikiReady && !!this.language;
    if (showingSkeleton) this.setAttribute('aria-busy', 'true');
    else this.removeAttribute('aria-busy');
  }

  private syncHighlight(): void {
    const hl = this.highlighter;
    const lang = this.language;
    if (!hl || !lang) {
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
    const token = ++this.highlightToken;
    void loadShikiLanguage(hl, lang).then((ok) => {
      if (token !== this.highlightToken) return; // superseded by a newer code/language change
      this.highlightedHtml = ok ? this.tokenize(hl, lang) : null;
    });
  }

  private tokenize(hl: ShikiHighlighter, lang: string): string | null {
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
        transformers: [partTransformer],
      });
    } catch {
      // Malformed input for this grammar, or any other shiki-internal
      // failure -- fall back to plain text rather than a blank code block.
      return null;
    }
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
                aria-label=${this.collapsed ? 'Expand code' : 'Collapse code'}
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
                aria-label=${this.justCopied ? 'Copied to clipboard' : 'Copy code'}
                @click=${this.copy}
              >
                ${this.justCopied ? 'Copied!' : 'Copy'}
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
    const showSkeleton = !this.shikiReady && !!this.language;
    const bodyHidden = this.collapsible && this.collapsed;
    const bodyLabel = this.filename || (this.language ? `${this.language} code` : 'Code');

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
              : html`<pre part="pre"><code part="code">${this.code}</code></pre>`}
        </div>
      </div>
    `;
  }
}

defineElement('code-block', LyraCodeBlock);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-code-block': LyraCodeBlock;
  }
}
