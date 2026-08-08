import { type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import {
  loadShikiHighlighter,
  loadShikiLanguage,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  type ShikiHighlighter,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from './code-loader.js';
import { styles } from './code-block.styles.js';
import { resolveIsDarkTheme, watchDarkTheme } from './shiki-dark-theme.js';
import {
  CODE_BLOCK_COPY_CONFIRM_MS,
  applyCodeBlockAriaBusy,
  clampCodeBlockFocusedLine,
  codeBlockActiveHighlightLineSet,
  codeBlockEventLine,
  codeBlockLineHasFocus,
  codeBlockLineCount,
  codeBlockLineHighlightSet,
  codeBlockLineKeyAction,
  codeBlockNeedsHighlightResync,
  codeBlockPreSuppliedGrammar,
  codeBlockSelectionAnchor,
  codeBlockShowsSkeleton,
  renderCodeBlockPlainCode,
  renderCodeBlockShell,
  restoreCodeBlockLineFocus,
  scrollCodeBlockToAnchor,
  tokenizeCodeBlock,
  writeCodeBlockClipboard,
} from './code-block-shared.js';
import type { LyraAnchor, LyraHighlight } from '../../viewers/document-viewer/anchors.js';
import '../../overlays/skeleton/skeleton.class.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_codeBlockLineLabel, LYRA_DEFAULT_codeRegion, LYRA_DEFAULT_codeRegionWithLanguage, LYRA_DEFAULT_collapse, LYRA_DEFAULT_collapseCode, LYRA_DEFAULT_copied, LYRA_DEFAULT_copiedToClipboard, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyCode, LYRA_DEFAULT_details, LYRA_DEFAULT_expandCode, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraCodeBlockEventMap {
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-toggle': CustomEvent<{ collapsed: boolean }>;
  'lr-line-click': CustomEvent<{ line: number }>;
  'lr-text-select': CustomEvent<{ text: string; anchor: LyraAnchor; rects: DOMRect[] }>;
}
/**
 * `<lr-code-block>` — fenced code display with optional lazy syntax
 * highlighting and a copy button. No highlighting grammar ships in this
 * component itself: it lazy-loads the optional peer dependency `shiki` (see
 * `code-loader.ts`) for the actual tokenizing, and degrades to a plain
 * `<pre><code>` when that peer isn't installed or `language` is unset/
 * unrecognized — the exact same optional-peer shape `<lr-markdown>` and
 * `<lr-chart>` already establish. That fallback is the *default* rendering
 * path, not a degraded one: unhighlighted code is perfectly usable, and it's
 * what every instance renders at zero extra bytes until shiki resolves.
 *
 * A `<lr-skeleton>` placeholder stands in only while shiki itself is
 * loading for the very first time on the page (cached — see
 * `loadShikiHighlighter()`) and `language` is set. It's deliberately *not*
 * shown again for a subsequent per-language grammar load (e.g. a second
 * `<lr-code-block>` requesting a language no earlier instance has used
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
 * Adopts the `line-range` slice of this library's shared anchor-target contract:
 * `highlights`/`activeHighlightId` paint (and `highlight-lines` additionally marks) per-line
 * emphasis in both the shiki and plain-text-fallback rendering paths identically, and
 * `scrollToAnchor()` resolves a `line-range` anchor. `interactive-lines` is a separate, purely
 * local affordance that turns the (`line-numbers`-gated) gutter into a keyboard-navigable,
 * clickable roving-tabindex group emitting `lr-line-click` — it doesn't require `highlights` to
 * be set. If controlled `code` shrinks while a line owns focus, focus follows the clamped
 * surviving line through both plain and highlighted DOM replacement; an explicit move to another
 * control during the update is never overridden.
 *
 * @customElement lr-code-block
 * @event lr-copy - The copy button was activated. `detail: { text }` is
 *   always the raw `code` value (never the highlighted HTML), and always
 *   fires regardless of whether the actual OS clipboard write succeeded —
 *   same convention as `<lr-json-viewer>`'s own copy button.
 * @event lr-toggle - The collapse/expand header button was activated.
 *   `detail: { collapsed }` — same event name and shape convention as
 *   `<lr-thinking-panel>`'s own `lr-toggle`.
 * @event lr-line-click - A gutter line number was activated (click, or Enter/Space while
 *   focused) while `interactive-lines` is set. `detail: { line }`.
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
 * @cssprop [--lr-code-block-max-height=none] - Scroll cap applied to `body`. The `max-height`
 *   attribute, when set, writes this same property inline on `body` and therefore wins.
 * @cssprop [--lr-code-block-font=var(--lr-font-mono)] - Monospace family for the rendered `pre`
 *   and `code`.
 * @cssprop [--lr-code-block-tab-size=2] - Tab width for the rendered code, applied to `pre`.
 *   Same default as `--lr-code-editor-tab-size`, so the editable and read-only code surfaces
 *   agree; `lr-markdown`/`lr-markdown-core` declare the same token for their own
 *   `code-block` part (they are sibling elements, so they cannot inherit this one). Read as a
 *   token and never written inline, so a host override survives shiki's own inline `style` on
 *   the highlighted `pre`. The default is a `var()` fallback at the point of use rather than a
 *   `:host` declaration, so it inherits: set it on the element, a container, or `:root` and it
 *   reaches every code surface below. The markdown surface wraps (`white-space: pre-wrap`) while
 *   this one does not, so the same value can look different on a wrapped line, where tab stops
 *   restart.
 * @cssprop [--lr-code-block-active-line-outline-color=var(--lr-color-brand)] - Outline color of
 *   the line marked active by `active-highlight-id`. Retints just that outline, leaving every
 *   other `--lr-color-brand` surface in the component (header pill, hover states, focus ring)
 *   alone. Inherits, so it can also be set on an ancestor or at the theme level.
 * @status stable
 * @since 4.0.0
 */
export class LyraCodeBlock extends LyraElement<LyraCodeBlockEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    codeBlockLineLabel: LYRA_DEFAULT_codeBlockLineLabel,
    codeRegion: LYRA_DEFAULT_codeRegion,
    codeRegionWithLanguage: LYRA_DEFAULT_codeRegionWithLanguage,
    collapse: LYRA_DEFAULT_collapse,
    collapseCode: LYRA_DEFAULT_collapseCode,
    copied: LYRA_DEFAULT_copied,
    copiedToClipboard: LYRA_DEFAULT_copiedToClipboard,
    copy: LYRA_DEFAULT_copy,
    copyCode: LYRA_DEFAULT_copyCode,
    details: LYRA_DEFAULT_details,
    expandCode: LYRA_DEFAULT_expandCode,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

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
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) copyable = true;

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
  private restoreFocusedLineAfterUpdate = false;

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

  /** When `true`, skips the *call* to the default `loadShikiHighlighter()` in
   *  `connectedCallback()` — for a consumer whose `languages` map already covers every language
   *  every instance will ever render. This is a runtime branch only, **not** a build-time
   *  exclusion: `loadShikiHighlighter` is still imported unconditionally at this module's top
   *  level (see the import list above), and a bundler doing static reachability/chunk analysis
   *  can't prove this flag is always `true`, so shiki's ~200-language dynamic-import table stays
   *  reachable from — and stays in the build output of — this component's module regardless of
   *  how `languagesOnly` is set. A consumer who actually needs that table excluded from their
   *  build has to import `<lr-code-block-core>` instead, whose module never references
   *  `loadShikiHighlighter` at all (see its own class doc). A `language` value absent from
   *  `languages` while this is `true` renders the plain-text fallback (no attempt to fall back to
   *  the now-unloaded default highlighter) rather than hanging. `false` (the default) reproduces
   *  today's unconditional `loadShikiHighlighter()` call exactly. */
  @property({ type: Boolean, attribute: 'languages-only' }) languagesOnly = false;

  // `null` covers every reason the plain-text fallback is showing: shiki
  // isn't installed, `language` is unset, or `language` isn't shiki-
  // recognized -- `render()` doesn't need to (and can't usefully) tell these
  // apart, same rationale as <lr-markdown>'s identically-shaped field.
  @state() private highlightedHtml: string | null = null;

  // Becomes true once the shared shiki-loading promise has settled, whether
  // or not it actually resolved to a highlighter -- gates the skeleton (see
  // the class doc's second paragraph), not the highlighting itself.
  @state() private shikiReady = false;

  @state() private justCopied = false;

  @state() private isDarkTheme = false;

  private stopWatchingTheme?: () => void;

  private highlighter?: ShikiHighlighter | null;

  // Guards the async per-language load in syncHighlight() against a
  // `code`/`language` change that arrives before a previous load resolves --
  // only the result matching the *current* token is ever applied.
  private highlightToken = 0;

  private copyTimer?: { owner: Window; handle: number };
  private defaultHighlighterLoading = false;

  private readonly bodyId = nextId('code-block-body');

  override connectedCallback(): void {
    super.connectedCallback();
    this.stopThemeWatcher();
    this.isDarkTheme = resolveIsDarkTheme(this);
    this.stopWatchingTheme = watchDarkTheme(this, () => {
      this.isDarkTheme = resolveIsDarkTheme(this);
    });
    this.ensureDefaultHighlighter();
  }

  private ensureDefaultHighlighter(): void {
    if (this.languagesOnly || !this.isConnected || this.highlighter !== undefined || this.defaultHighlighterLoading) return;
    this.defaultHighlighterLoading = true;
    void loadShikiHighlighter().then((hl) => {
      this.defaultHighlighterLoading = false;
      // loadShikiHighlighter() is a page-lifetime singleton promise -- it can
      // resolve well after this element has disconnected (or been torn down
      // for good). Bail out rather than mutate @state on a dead instance and
      // kick off syncHighlight()'s own further async grammar load for
      // nothing. Mirrors chart.ts's/markdown.ts's identical
      // connectedCallback() guard for the same race.
      if (!this.isConnected) return;
      this.highlighter = hl;
      this.shikiReady = true;
      this.syncHighlight();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cancelCopyTimer();
    this.justCopied = false;
    this.stopThemeWatcher();
  }

  adoptedCallback(): void {
    // A node can move between owner documents while already disconnected; always retire an
    // old-realm confirmation timer even when no further disconnect callback will run.
    this.cancelCopyTimer();
    this.justCopied = false;
    this.stopThemeWatcher();
  }

  private stopThemeWatcher(): void {
    const stop = this.stopWatchingTheme;
    this.stopWatchingTheme = undefined;
    stop?.();
  }

  private cancelCopyTimer(): void {
    const timer = this.copyTimer;
    this.copyTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  // The `languages` entry for the *current* `language`, if any -- shared by
  // `willUpdate()`/`updated()`/`render()`/`syncHighlight()` so they all agree
  // on whether this render is taking the fine-grained `languages` path or
  // the default `loadShikiHighlighter()` one.
  private preSuppliedGrammar(): ShikiLanguageInput | undefined {
    return codeBlockPreSuppliedGrammar(this.languages, this.language);
  }

  private lineHighlightSet(): Set<number> {
    return codeBlockLineHighlightSet(this.highlightLines, this.highlights, this.lineCount());
  }

  private activeHighlightLineSet(): Set<number> {
    return codeBlockActiveHighlightLineSet(this.highlights, this.activeHighlightId, this.lineCount());
  }

  private lineCount(): number {
    return codeBlockLineCount(this.code);
  }

  /** Resolves a `line-range` anchor (or a `highlights` id string resolving to one) by scrolling
   *  its start line into view within `[part="body"]`. Resolves `false` when the anchor isn't a
   *  `line-range`, the id isn't found, or the start line is out of bounds. */
  async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    return scrollCodeBlockToAnchor(this, target);
  }

  private onLineActivate(line: number): void {
    this.setFocusedLine(line);
    this.emit('lr-line-click', { line });
  }

  private setFocusedLine(line: number): void {
    this.focusedLine = line;
    for (const target of this.renderRoot.querySelectorAll<HTMLElement>('[data-line][part~="line-button"]')) {
      target.tabIndex = Number(target.dataset['line']) === line ? 0 : -1;
    }
  }

  // Roving-tabindex keyboard navigation across the gutter's line buttons (only rendered by
  // renderPlainCode() while interactiveLines && lineNumbers are both set).
  private onLineKeyDown = (e: KeyboardEvent, line: number): void => {
    const action = codeBlockLineKeyAction(e.key, line, this.lineCount());
    if (action === null) return;
    e.preventDefault();
    if (action.kind === 'activate') {
      this.onLineActivate(line);
      return;
    }
    const next = action.line;
    this.setFocusedLine(next);
    this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLElement>(`[data-line="${next}"]`)?.focus();
    });
  };

  private onBodyClick = (e: MouseEvent): void => {
    if ((e.composedPath()[0] as Element | undefined)?.closest?.('button.line')) return;
    const line = codeBlockEventLine(e);
    if (line !== null) this.onLineActivate(line);
  };

  private onBodyKeyDown = (e: KeyboardEvent): void => {
    if ((e.composedPath()[0] as Element | undefined)?.closest?.('button.line')) return;
    const line = codeBlockEventLine(e);
    if (line !== null) this.onLineKeyDown(e, line);
  };

  private onBodyFocusIn = (e: FocusEvent): void => {
    const line = codeBlockEventLine(e);
    if (line !== null) this.setFocusedLine(line);
  };

  /** Anchors a text selection ending inside `[part="body"]` to the `line-range` it spans, so a
   *  host can persist or otherwise act on it. Fires nothing when there's no active selection. */
  private onBodyMouseUp = (): void => {
    const selection = codeBlockSelectionAnchor(this.shadowRoot);
    if (selection) this.emit('lr-text-select', selection);
  };

  // Mutating `highlightedHtml` here (rather than in `updated()`) absorbs the
  // synchronous case -- language already loaded, see `syncHighlight()` --
  // into this same update cycle instead of scheduling a second one, Lit's
  // documented pattern for deriving one reactive property from a change to
  // others (same approach <lr-markdown>'s `willUpdate` takes).
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    this.restoreFocusedLineAfterUpdate = codeBlockLineHasFocus(this);
    if (changed.has('code')) {
      this.focusedLine = clampCodeBlockFocusedLine(this.focusedLine, this.lineCount());
    }
    if (!codeBlockNeedsHighlightResync(changed)) return;
    if (changed.has('languagesOnly') && !this.languagesOnly) this.ensureDefaultHighlighter();
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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    applyCodeBlockAriaBusy(this, this.showsSkeleton());
    if (this.restoreFocusedLineAfterUpdate) {
      restoreCodeBlockLineFocus(this, this.focusedLine);
      this.restoreFocusedLineAfterUpdate = false;
    }
  }

  /** Whether this render shows the loading skeleton instead of the code. `languagesOnly` skips the
   *  default loader entirely (see `ensureDefaultHighlighter()`), so `shikiReady` never becomes true
   *  for it -- treat that as "nothing to wait for" rather than "still loading", the same way a
   *  `preSuppliedGrammar()` match already does. Read by both `updated()` and `render()` so the
   *  `aria-busy` host attribute can never disagree with what's on screen. */
  private showsSkeleton(): boolean {
    return codeBlockShowsSkeleton(
      this.shikiReady,
      this.language,
      !this.languagesOnly && !this.preSuppliedGrammar(),
    );
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

    if (this.languagesOnly) {
      this.highlightedHtml = null;
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
    return tokenizeCodeBlock(hl, {
      code: this.code,
      lang,
      lineNumbers: this.lineNumbers,
      interactiveLines: this.interactiveLines,
      focusedLine: this.focusedLine,
      highlightedLines: this.lineHighlightSet(),
      activeLines: this.activeHighlightLineSet(),
      lineDescription: (line) => this.localize('codeBlockLineLabel', undefined, { line }),
    });
  }

  // Delegates to the shared renderCodeBlockPlainCode() in code-block-shared.ts -- previously a
  // byte-for-byte-duplicated private method also defined on <lr-code-block-core>, moved out to
  // stop that pair's plain-text-fallback rendering from silently drifting apart. See that
  // function's own doc for the rendering behavior.
  private renderPlainCode(): TemplateResult {
    return renderCodeBlockPlainCode({
      code: this.code,
      lineNumbers: this.lineNumbers,
      interactiveLines: this.interactiveLines,
      focusedLine: this.focusedLine,
      highlightedLines: this.lineHighlightSet(),
      activeLines: this.activeHighlightLineSet(),
      localize: this.localize.bind(this),
      onLineActivate: (line) => this.onLineActivate(line),
      onLineKeyDown: (e, line) => this.onLineKeyDown(e, line),
    });
  }

  private copy = (): void => {
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    writeCodeBlockClipboard(this.code, owner);
    this.emit('lr-copy', { text: this.code });
    if (!owner) return;
    this.justCopied = true;
    this.cancelCopyTimer();
    let handle = 0;
    handle = owner.setTimeout(() => {
      if (
        this.copyTimer?.owner !== owner
        || this.copyTimer.handle !== handle
        || !this.isConnected
        || this.ownerDocument.defaultView !== owner
      ) return;
      this.copyTimer = undefined;
      this.justCopied = false;
    }, CODE_BLOCK_COPY_CONFIRM_MS);
    this.copyTimer = { owner, handle };
  };

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit('lr-toggle', { collapsed: this.collapsed });
  };

  // The header row and the whole body/skeleton/`<pre>` shell come from
  // renderCodeBlockShell() in code-block-shared.ts -- see that function's own
  // doc for the `[part="body"]` tabindex/role rationale. Both were previously
  // duplicated verbatim on <lr-code-block-core>.
  override render(): TemplateResult {
    return renderCodeBlockShell({
      filename: this.filename,
      language: this.language,
      copyable: this.copyable,
      collapsible: this.collapsible,
      collapsed: this.collapsed,
      justCopied: this.justCopied,
      bodyId: this.bodyId,
      accessibleLabel: this.accessibleLabel,
      maxHeight: this.maxHeight,
      isDarkTheme: this.isDarkTheme,
      showSkeleton: this.showsSkeleton(),
      highlightedHtml: this.highlightedHtml,
      lineNumbers: this.lineNumbers,
      localize: this.localize.bind(this),
      renderPlainCode: () => this.renderPlainCode(),
      onToggle: this.toggleCollapsed,
      onCopy: this.copy,
      onBodyMouseUp: this.onBodyMouseUp,
      onBodyClick: this.onBodyClick,
      onBodyKeyDown: this.onBodyKeyDown,
      onBodyFocusIn: this.onBodyFocusIn,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-code-block': LyraCodeBlock;
  }
}
