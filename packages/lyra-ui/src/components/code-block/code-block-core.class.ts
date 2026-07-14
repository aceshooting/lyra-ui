import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { chevronIcon } from '../../internal/icons.js';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import { loadShikiHighlighterCore, SHIKI_THEMES, type ShikiHighlighterCore, type ShikiLanguageInput } from './code-loader.js';
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
const partTransformer = {
  name: 'lyra-code-block-parts',
  pre(node: OptionalPeerApi) {
    node.properties.part = ['pre'];
    delete node.properties.tabindex;
  },
  code(node: OptionalPeerApi) {
    node.properties.part = ['code'];
  },
};

export interface LyraCodeBlockCoreEventMap {
  'lyra-copy': CustomEvent<{ text: string }>;
  'lyra-toggle': CustomEvent<{ collapsed: boolean }>;
}
/**
 * `<lyra-code-block-core>` — a build-lean variant of `<lyra-code-block>` for
 * a consumer whose `languages` map already covers every language it will
 * ever render. It only ever calls `loadShikiHighlighterCore(this.languages)`
 * (see `code-loader.ts`) — never `loadShikiHighlighter()`, the default
 * ~200-language dynamic-import table loader `<lyra-code-block>` calls
 * unconditionally unless its runtime `languagesOnly` flag is `true`. A
 * runtime flag on that same module can't be proven always-`true` by a
 * bundler, so the unconditional call (and everything shiki's main entry
 * point can reach from it) always stays in the build output regardless of
 * how that flag is used. This component's own module never textually
 * contains a call to (or import of) `loadShikiHighlighter` at all, so a
 * consumer importing this entry point instead of `code-block.js` gets a
 * genuinely shiki-full-table-free build.
 *
 * A `language` value absent from `languages` always renders the plain
 * `<pre><code>` fallback — there is no default/full-table highlighter here
 * to fall back to, unlike `<lyra-code-block>`'s dynamic-import path for an
 * unmapped language. That fallback is the *default* rendering path, not a
 * degraded one, same as `<lyra-code-block>`'s own plain-text fallback.
 *
 * Everything else — `code`/`language`/`filename`/`copyable`/`collapsible`/
 * `collapsed`/`maxHeight`, the copy button, the collapse header toggle, the
 * loading-skeleton behavior while the fine-grained highlighter itself
 * resolves — matches `<lyra-code-block>` exactly.
 *
 * @customElement lyra-code-block-core
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
export class LyraCodeBlockCore extends LyraElement<LyraCodeBlockCoreEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The raw source text. */
  @property() code = '';

  /** A shiki-recognized language id or alias (e.g. `"javascript"`,
   *  `"python"`, `"json"`). When unset, or when it isn't a key in
   *  `languages`, the code renders as plain unhighlighted text — this
   *  component has no default/full-table highlighter to fall back to. */
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

  /** Grammar definitions this instance can highlight, e.g. `{ json: jsonGrammar }` (import from
   *  `shiki/langs/<name>.mjs`). This component has no default/full-table fallback highlighter --
   *  a `language` absent from this map always renders the plain-text fallback. Empty (the
   *  default) never highlights at all. */
  @property({ attribute: false }) languages: Record<string, ShikiLanguageInput> = {};

  // `null` covers every reason the plain-text fallback is showing: `language`
  // is unset, isn't a key in `languages`, or the fine-grained highlighter
  // hasn't resolved yet -- `render()` doesn't need to (and can't usefully)
  // tell these apart, same rationale as <lyra-markdown>'s identically-shaped
  // field.
  @state() private highlightedHtml: string | null = null;

  // Becomes true once loadShikiHighlighterCore()'s promise has settled,
  // whether or not it actually resolved to a highlighter -- gates the
  // skeleton (see the class doc), not the highlighting itself.
  @state() private shikiReady = false;

  @state() private justCopied = false;

  private highlighter?: ShikiHighlighterCore | null;

  // Guards the async per-language load in syncHighlight() against a
  // `code`/`language` change that arrives before a previous load resolves --
  // only the result matching the *current* token is ever applied.
  private highlightToken = 0;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  private readonly bodyId = nextId('code-block-body');

  connectedCallback(): void {
    super.connectedCallback();
    if (Object.keys(this.languages).length === 0) return; // no languages supplied -- stays in the plain-text-fallback state permanently, same as languagesOnly + no matching grammar already behaves in lyra-code-block today
    void loadShikiHighlighterCore(this.languages).then((hl) => {
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
  // on whether this language is highlightable at all.
  private preSuppliedGrammar(): ShikiLanguageInput | undefined {
    return this.languages?.[this.language];
  }

  // Mutating `highlightedHtml` here (rather than in `updated()`) absorbs the
  // synchronous case -- language already loaded, see `syncHighlight()` --
  // into this same update cycle instead of scheduling a second one, Lit's
  // documented pattern for deriving one reactive property from a change to
  // others (same approach <lyra-markdown>'s `willUpdate` takes).
  protected willUpdate(changed: PropertyValues): void {
    if (!(changed.has('code') || changed.has('language') || changed.has('languages'))) return;
    if (this.shikiReady || this.preSuppliedGrammar()) {
      this.syncHighlight();
    }
  }

  protected updated(): void {
    const showingSkeleton = !this.shikiReady && !!this.language && !!this.preSuppliedGrammar();
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
    const lang = this.language;
    if (!lang) {
      this.highlightedHtml = null;
      return;
    }

    const languages = this.languages;
    if (!languages?.[lang]) {
      // Not in the supplied languages map -- there is no default
      // highlighter to fall back to in this variant, so this always
      // renders the plain-text fallback, unlike <lyra-code-block>'s
      // dynamic-import path for an unmapped language.
      this.highlightedHtml = null;
      return;
    }

    // Mirrors <lyra-code-block>'s own fine-grained branch: calls
    // loadShikiHighlighterCore() directly rather than only reading a
    // cached `this.highlighter` -- `languages` may be supplied any time
    // after `connectedCallback()` already ran (e.g. set as a property right
    // after creation), so this can't rely solely on that one-time eager
    // load. loadShikiHighlighterCore() itself caches by `languages` object
    // identity, so a call here that lands on the same map
    // connectedCallback() already kicked off just resolves the shared
    // cached promise instead of loading twice.
    this.highlightedHtml = null;
    void loadShikiHighlighterCore(languages).then((hl) => {
      if (token !== this.highlightToken) return; // superseded by a newer code/language/languages change
      this.highlighter = hl;
      this.shikiReady = true;
      this.highlightedHtml = hl ? this.tokenize(hl, lang) : null;
    });
  }

  private tokenize(hl: ShikiHighlighterCore, lang: string): string | null {
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
    const showSkeleton = !this.shikiReady && !!this.language && !!this.preSuppliedGrammar();
    const bodyHidden = this.collapsible && this.collapsed;
    const bodyLabel = codeBlockBodyLabel(this.localize.bind(this), this.filename, this.language);

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


declare global {
  interface HTMLElementTagNameMap {
    'lyra-code-block-core': LyraCodeBlockCore;
  }
}
