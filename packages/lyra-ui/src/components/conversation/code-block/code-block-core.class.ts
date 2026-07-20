import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import {
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from './code-loader.js';
import { styles } from './code-block.styles.js';
import { resolveIsDarkTheme, watchDarkTheme } from './shiki-dark-theme.js';
import {
  codeBlockToggleLabel,
  codeBlockCopyLabel,
  codeBlockBodyLabel,
  codeBlockLineTransformer,
  parseHighlightLines,
} from './code-block-shared.js';
import type { LyraAnchor, LyraHighlight } from '../../viewers/document-viewer/anchors.js';
import '../../overlays/skeleton/skeleton.class.js';

/** How long the copy button's confirmation state lasts before reverting. */
const COPY_CONFIRM_MS = 1500;

export interface LyraCodeBlockCoreEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-toggle': CustomEvent<{ collapsed: boolean }>;
  'lr-line-click': CustomEvent<{ line: number }>;
  'lr-highlight-activate': CustomEvent<{ id: string }>;
  'lr-text-select': CustomEvent<{ text: string; anchor: LyraAnchor; rects: DOMRect[] }>;
}
/**
 * `<lr-code-block-core>` — a build-lean variant of `<lr-code-block>` for
 * a consumer whose `languages` map already covers every language it will
 * ever render. It only ever calls `loadShikiHighlighterCore(this.languages)`
 * (see `code-loader.ts`) — never `loadShikiHighlighter()`, the default
 * ~200-language dynamic-import table loader `<lr-code-block>` calls
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
 * to fall back to, unlike `<lr-code-block>`'s dynamic-import path for an
 * unmapped language. That fallback is the *default* rendering path, not a
 * degraded one, same as `<lr-code-block>`'s own plain-text fallback.
 *
 * Everything else — `code`/`language`/`filename`/`copyable`/`collapsible`/
 * `collapsed`/`maxHeight`, the copy button, the collapse header toggle, the
 * loading-skeleton behavior while the fine-grained highlighter itself
 * resolves — matches `<lr-code-block>` exactly. A host `aria-label` (or
 * the matching `accessibleLabel` property) is forwarded to the internal
 * focusable element that owns the named `group` role.
 *
 * Adopts the `line-range` slice of this library's shared anchor-target contract, identical to
 * `<lr-code-block>`: `highlights`/`activeHighlightId` paint (and `highlight-lines` additionally
 * marks) per-line emphasis in both the shiki and plain-text-fallback rendering paths identically,
 * and `scrollToAnchor()` resolves a `line-range` anchor. `interactive-lines` is a separate, purely
 * local affordance that turns the (`line-numbers`-gated) gutter into a keyboard-navigable,
 * clickable roving-tabindex group emitting `lr-line-click` — it doesn't require `highlights` to
 * be set.
 *
 * @customElement lr-code-block-core
 * @event lr-copy - The copy button was activated. `detail: { text }` is
 *   always the raw `code` value (never the highlighted HTML), and always
 *   fires regardless of whether the actual OS clipboard write succeeded —
 *   same convention as `<lr-json-viewer>`'s own copy button.
 * @event lr-toggle - The collapse/expand header button was activated.
 *   `detail: { collapsed }` — same event name and shape convention as
 *   `<lr-thinking-panel>`'s own `lr-toggle`.
 * @event lr-line-click - A gutter line number was activated (click, or Enter/Space while
 *   focused) while `interactive-lines` is set. `detail: { line }`.
 * @event lr-highlight-activate - Declared for parity with this library's other anchor-target
 *   viewers so a consumer can attach a listener without a type error; not currently emitted by
 *   this component. `detail: { id }`.
 * @event lr-text-select - Fired when a text selection inside the code body ends. `detail: {
 *   text, anchor, rects }`; `anchor` is a `line-range` anchor covering the selected lines.
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
 * @csspart line-highlight - A line marked by `highlight-lines` or a `line-range` entry in
 *   `highlights`.
 * @csspart line-button - A gutter line-number button, only rendered while `interactive-lines` and
 *   `line-numbers` are both set.
 * @cssprop [--lr-code-block-tab-size=2] - Tab width for the rendered code, applied to `pre`.
 *   Shared with `lr-code-block` (this component reuses its stylesheet), `lr-code-editor`, and
 *   the markdown viewers' own `code-block` part, so every code surface agrees on a tab's width.
 * @cssprop [--lr-code-block-active-line-outline-color=var(--lr-color-brand)] - Outline color of
 *   the line marked active by `active-highlight-id`, leaving every other `--lr-color-brand`
 *   surface in the component alone.
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

  /** Comma-separated 1-based inclusive line ranges (e.g. `"3-5,7"`) to visually emphasize.
   *  Declarative sugar over `highlights` — merges with, and renders identically to, any
   *  `line-range` entries in `highlights`. */
  @property({ attribute: 'highlight-lines' }) highlightLines = '';

  /** Turns the (`line-numbers`-gated) gutter into a roving-tabindex group of buttons emitting
   *  `lr-line-click`. Has no effect while `line-numbers` is unset. */
  @property({ type: Boolean, attribute: 'interactive-lines' }) interactiveLines = false;

  /** Host-supplied highlights to paint over the code. Only `line-range` anchors are meaningful
   *  here — every other `LyraAnchor` kind is ignored. */
  @property({ attribute: false }) highlights: LyraHighlight[] = [];

  /** The `highlights` entry, if any, currently treated as active (`data-active` on its lines). */
  @property({ attribute: 'active-highlight-id' }) activeHighlightId: string | null = null;

  /** Anchor kinds this component resolves via `scrollToAnchor()`. */
  readonly anchorKinds: LyraAnchor['kind'][] = ['line-range'];

  @state() private focusedLine = 1;

  /** Grammar definitions this instance can highlight, e.g. `{ json: jsonGrammar }` (import from
   *  `shiki/langs/<name>.mjs`). This component has no default/full-table fallback highlighter --
   *  a `language` absent from this map always renders the plain-text fallback. Empty (the
   *  default) never highlights at all. */
  @property({ attribute: false }) languages: Record<string, ShikiLanguageInput> = {};

  // `null` covers every reason the plain-text fallback is showing: `language`
  // is unset, isn't a key in `languages`, or the fine-grained highlighter
  // hasn't resolved yet -- `render()` doesn't need to (and can't usefully)
  // tell these apart, same rationale as <lr-markdown>'s identically-shaped
  // field.
  @state() private highlightedHtml: string | null = null;

  // Becomes true once loadShikiHighlighterCore()'s promise has settled,
  // whether or not it actually resolved to a highlighter -- gates the
  // skeleton (see the class doc), not the highlighting itself.
  @state() private shikiReady = false;

  @state() private justCopied = false;

  @state() private isDarkTheme = false;

  private stopWatchingTheme?: () => void;

  private highlighter?: ShikiHighlighterCore | null;

  // Guards the async per-language load in syncHighlight() against a
  // `code`/`language` change that arrives before a previous load resolves --
  // only the result matching the *current* token is ever applied.
  private highlightToken = 0;

  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  private readonly bodyId = nextId('code-block-body');

  connectedCallback(): void {
    super.connectedCallback();
    this.isDarkTheme = resolveIsDarkTheme(this);
    this.stopWatchingTheme = watchDarkTheme(this, () => {
      this.isDarkTheme = resolveIsDarkTheme(this);
    });
    if (Object.keys(this.languages).length === 0) return; // no languages supplied -- stays in the plain-text-fallback state permanently, same as languagesOnly + no matching grammar already behaves in lr-code-block today
    void loadShikiHighlighterCore(this.languages).then((hl) => {
      // loadShikiHighlighterCore() is a shared, cached-by-languages promise --
      // it can resolve well after this element has disconnected (or been torn
      // down for good). Bail out rather than mutate @state on a dead instance
      // and kick off syncHighlight()'s own further async grammar load for
      // nothing. Mirrors chart.ts's/markdown.ts's/lr-code-block's identical
      // connectedCallback() guard for the same race.
      if (!this.isConnected) return;
      this.highlighter = hl;
      this.shikiReady = true;
      this.syncHighlight();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.copyTimeoutId);
    this.stopWatchingTheme?.();
  }

  // The `languages` entry for the *current* `language`, if any -- shared by
  // `willUpdate()`/`updated()`/`render()`/`syncHighlight()` so they all agree
  // on whether this language is highlightable at all.
  private preSuppliedGrammar(): ShikiLanguageInput | undefined {
    const language = normalizeShikiLanguage(this.language);
    return this.languages?.[language] ?? this.languages?.[this.language];
  }

  /** The merged set of one-based line numbers to emphasize: `highlightLines` plus the `line-range`
   *  slice of `highlights`. Shared by both the shiki transformer options and the plain-text
   *  fallback path so their emphasis is always identical. */
  private lineHighlightSet(): Set<number> {
    const merged = parseHighlightLines(this.highlightLines);
    for (const highlight of this.highlights) {
      if (highlight.anchor.kind !== 'line-range') continue;
      const end = highlight.anchor.end ?? highlight.anchor.start;
      for (let n = highlight.anchor.start; n <= end; n++) merged.add(n);
    }
    return merged;
  }

  /** The line numbers covered by the `highlights` entry matching `activeHighlightId`, if any. */
  private activeHighlightLineSet(): Set<number> {
    const active = this.highlights.find((h) => h.id === this.activeHighlightId);
    const result = new Set<number>();
    if (!active || active.anchor.kind !== 'line-range') return result;
    const end = active.anchor.end ?? active.anchor.start;
    for (let n = active.anchor.start; n <= end; n++) result.add(n);
    return result;
  }

  private lineCount(): number {
    return this.code.split(/\r\n|\r|\n/).length;
  }

  /** Resolves a `line-range` anchor (or a `highlights` id string resolving to one) by scrolling
   *  its start line into view within `[part="body"]`. Resolves `false` when the anchor isn't a
   *  `line-range`, the id isn't found, or the start line is out of bounds. */
  async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    const anchor = typeof target === 'string' ? this.highlights.find((h) => h.id === target)?.anchor : target;
    if (!anchor || anchor.kind !== 'line-range') return false;
    if (anchor.start < 1 || anchor.start > this.lineCount()) return false;
    await this.updateComplete;
    const body = this.renderRoot.querySelector('[part="body"]') as HTMLElement | null;
    const lineEl = this.renderRoot.querySelector(`[data-line="${anchor.start}"]`) as HTMLElement | null;
    if (!body || !lineEl) return false;
    const offset = lineEl.offsetTop - body.clientHeight / 2;
    body.scrollTo({ top: Math.max(0, offset), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    return true;
  }

  private onLineActivate(line: number): void {
    this.focusedLine = line;
    this.emit('lr-line-click', { line });
  }

  // Roving-tabindex keyboard navigation across the gutter's line buttons (only rendered by
  // renderPlainCode() while interactiveLines && lineNumbers are both set).
  private onLineKeyDown = (e: KeyboardEvent, line: number): void => {
    const total = this.lineCount();
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = Math.min(total, line + 1);
    else if (e.key === 'ArrowUp') next = Math.max(1, line - 1);
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = total;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onLineActivate(line);
      return;
    }
    if (next === null || next === line) return;
    e.preventDefault();
    this.focusedLine = next;
    this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLButtonElement>(`[data-line="${next}"]`)?.focus();
    });
  };

  /** Anchors a text selection ending inside `[part="body"]` to the `line-range` it spans, so a
   *  host can persist or otherwise act on it. Fires nothing when there's no active selection. */
  private onBodyMouseUp = (): void => {
    // `ShadowRoot.getSelection` is a Chromium-only extension absent from the standard DOM lib
    // types -- same shadow-scoped-selection precedent as <lr-terminal>'s own onViewportPointerUp.
    const shadowSelection = (
      this.shadowRoot as unknown as { getSelection?: () => Selection | null } | null
    )?.getSelection?.();
    const selection = shadowSelection ?? window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const text = selection.toString();
    if (!text.trim()) return;
    const range = selection.getRangeAt(0);
    const lineOf = (node: Node): number | null => {
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      const lineEl = el?.closest('[data-line]');
      const attr = lineEl?.getAttribute('data-line');
      return attr === null || attr === undefined ? null : Number(attr);
    };
    const start = lineOf(range.startContainer);
    const end = lineOf(range.endContainer);
    if (start === null || end === null) return;
    this.emit('lr-text-select', {
      text,
      anchor: { kind: 'line-range', start: Math.min(start, end), end: Math.max(start, end) },
      rects: Array.from(range.getClientRects()),
    });
  };

  // Mutating `highlightedHtml` here (rather than in `updated()`) absorbs the
  // synchronous case -- language already loaded, see `syncHighlight()` --
  // into this same update cycle instead of scheduling a second one, Lit's
  // documented pattern for deriving one reactive property from a change to
  // others (same approach <lr-markdown>'s `willUpdate` takes).
  protected willUpdate(changed: PropertyValues): void {
    // highlightLines/highlights/activeHighlightId/lineNumbers all feed codeBlockLineTransformer's
    // options in tokenize() below -- any of them changing (even without code/language/languages
    // changing) means the cached highlightedHtml needs recomputing to stay in sync.
    if (
      !(
        changed.has('code') ||
        changed.has('language') ||
        changed.has('languages') ||
        changed.has('highlightLines') ||
        changed.has('highlights') ||
        changed.has('activeHighlightId') ||
        changed.has('lineNumbers')
      )
    )
      return;
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
    const lang = normalizeShikiLanguage(this.language);
    if (!lang) {
      this.highlightedHtml = null;
      return;
    }

    const languages = this.languages;
    if (!languages?.[lang] && !languages?.[this.language]) {
      // Not in the supplied languages map -- there is no default
      // highlighter to fall back to in this variant, so this always
      // renders the plain-text fallback, unlike <lr-code-block>'s
      // dynamic-import path for an unmapped language.
      this.highlightedHtml = null;
      return;
    }

    // Mirrors <lr-code-block>'s own fine-grained branch: calls
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
      // Lit's first update cycle (which is what calls syncHighlight() via
      // willUpdate() for an element that had `language`/`languages` set
      // before it ever connected) still runs even if the element disconnects
      // in the same synchronous tick as connectedCallback(), before that
      // first update's microtask fires -- so this needs its own isConnected
      // guard alongside connectedCallback()'s, not just the staleness check
      // above, to avoid mutating @state on a dead instance.
      if (!this.isConnected) return;
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
        // theme data), not this library's --lr-* design tokens -- the one
        // deliberate exception to every other color in this component being
        // a --lr-* token. See the dark-mode override in
        // code-block.styles.ts for how the dark half of this activates.
        themes: SHIKI_THEMES,
        transformers: [
          codeBlockLineTransformer({
            lineNumbers: this.lineNumbers,
            highlightedLines: this.lineHighlightSet(),
            activeLines: this.activeHighlightLineSet(),
          }),
        ],
      });
    } catch {
      // Malformed input for this grammar, or any other shiki-internal
      // failure -- fall back to plain text rather than a blank code block.
      return null;
    }
  }

  // Always splits into per-line spans/buttons (not just while lineNumbers is set) -- the per-line
  // wrapper is what highlight-lines/highlights/interactive-lines attach to. .split() consumes each
  // newline character, so a literal '\n' text node is re-inserted between lines to keep the
  // non-line-numbered case's visual output (relying on [part='pre']'s white-space:pre) identical
  // to the previous single-text-node rendering -- the line-numbered case's .line elements are
  // already display:block (code-block.styles.ts) so that text node is inert there. interactiveLines
  // only takes effect alongside lineNumbers -- the shiki-highlighted path doesn't render gutter
  // buttons (see the class doc), only data-line/data-highlighted/data-active/part="line-highlight"
  // from codeBlockLineTransformer above.
  private renderPlainCode(): TemplateResult {
    const highlighted = this.lineHighlightSet();
    const active = this.activeHighlightLineSet();
    const lines = this.code.split(/\r\n|\r|\n/);
    const interactive = this.interactiveLines && this.lineNumbers;
    // The `>` sits on its own line right before the expression (and `</code` right after it,
    // closing on the following line) so no incidental whitespace text node lands inside <code> --
    // its textContent must be exactly the concatenated line text, matching the pre-existing
    // single-text-node rendering this replaces.
    return html`<code part="code" class=${this.lineNumbers ? 'line-numbered-code' : nothing}
        >${lines.map((line, index) => {
          const lineNumber = index + 1;
          const isHighlighted = highlighted.has(lineNumber);
          const isActive = active.has(lineNumber);
          const part = interactive
            ? isHighlighted
              ? 'line-button line-highlight'
              : 'line-button'
            : isHighlighted
              ? 'line-highlight'
              : nothing;
          const lineTemplate = interactive
            ? html`<button
                type="button"
                class="line"
                part=${part}
                data-line=${lineNumber}
                ?data-highlighted=${isHighlighted}
                ?data-active=${isActive}
                aria-label=${this.localize('codeBlockLineLabel', undefined, { line: lineNumber })}
                tabindex=${this.focusedLine === lineNumber ? 0 : -1}
                @click=${() => this.onLineActivate(lineNumber)}
                @keydown=${(e: KeyboardEvent) => this.onLineKeyDown(e, lineNumber)}
              >${line}</button>`
            : html`<span
                class="line"
                part=${part}
                data-line=${lineNumber}
                ?data-highlighted=${isHighlighted}
                ?data-active=${isActive}
              >${line}</span>`;
          // Only the non-line-numbered case needs the newline text node re-inserted -- the
          // line-numbered case's .line elements are already display:block (code-block.styles.ts),
          // and its own existing test asserts textContent has no embedded newlines between lines.
          return index > 0 && !this.lineNumbers ? html`\n${lineTemplate}` : lineTemplate;
        })}</code
      >`;
  }

  private writeClipboard(text: string): void {
    try {
      // navigator.clipboard is absent in insecure contexts / older browsers,
      // and some engines throw synchronously rather than rejecting -- either
      // way this is best-effort; copy() below always emits lr-copy
      // regardless of whether the OS clipboard was actually reached. Same
      // precedent as <lr-json-viewer>'s own copy button.
      void navigator.clipboard?.writeText(text)?.catch(() => {});
    } catch {
      // see above
    }
  }

  private copy = (): void => {
    this.writeClipboard(this.code);
    this.emit('lr-copy', { text: this.code });
    this.justCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.justCopied = false;
    }, COPY_CONFIRM_MS);
  };

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit<{ collapsed: boolean }>('lr-toggle', { collapsed: this.collapsed });
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
  // lr-virtual-list's own `[part="base"]` documents for its identical
  // tabindex. `role="group"` (rather than e.g. `region`, a page landmark
  // role) plus `aria-label` gives it an accessible name without claiming
  // landmark/navigation significance for what is, structurally, just one
  // small piece of a larger document.
  render(): TemplateResult {
    const hasHeader = !!this.filename || !!this.language || this.copyable || this.collapsible;
    const showSkeleton = !this.shikiReady && !!this.language && !!this.preSuppliedGrammar();
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
          data-dark-theme=${this.isDarkTheme ? 'true' : nothing}
          style=${this.maxHeight ? `--lr-code-block-max-height:${this.maxHeight}` : nothing}
          @mouseup=${this.onBodyMouseUp}
        >
          ${showSkeleton
            ? html`<lr-skeleton variant="rect"></lr-skeleton>`
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
    'lr-code-block-core': LyraCodeBlockCore;
  }
}
