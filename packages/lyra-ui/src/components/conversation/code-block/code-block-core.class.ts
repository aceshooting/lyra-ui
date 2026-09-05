import { type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { snapshotLyraHighlights } from '../../../internal/highlight-collection.js';
import type {
  LyraClipboardWriteFailure,
  LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import {
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from './shiki-types.js';
import { styles } from './code-block.styles.js';
import {
  CodeBlockInteractionController,
  applyCodeBlockAriaBusy,
  clampCodeBlockFocusedLine,
  codeBlockActiveHighlightLineSet,
  codeBlockLineHasFocus,
  codeBlockLineCount,
  codeBlockLineHighlightSet,
  codeBlockPreSuppliedGrammar,
  codeBlockShowsSkeleton,
  renderCodeBlockPlainCode,
  renderCodeBlockShell,
  restoreCodeBlockLineFocus,
  scrollCodeBlockToAnchor,
  tokenizeCodeBlock,
} from './code-block-shared.js';
import type {
  LyraAnchor,
  LyraHighlight,
  TextSelectRect,
} from '../../viewers/document-viewer/anchors.js';
import '../../overlays/skeleton/skeleton.class.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_codeBlockLineLabel, LYRA_DEFAULT_codeRegion, LYRA_DEFAULT_codeRegionWithLanguage, LYRA_DEFAULT_collapseCode, LYRA_DEFAULT_copied, LYRA_DEFAULT_copiedToClipboard, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyCode, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_expandCode } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraCodeBlockCoreEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-toggle-request': CustomEvent<{ collapsed: boolean }>;
  'lr-toggle': CustomEvent<{ collapsed: boolean }>;
  'lr-line-activate': CustomEvent<{ line: number }>;
  'lr-text-select': CustomEvent<{
    readonly text: string;
    readonly anchor: LyraAnchor;
    readonly rects: readonly TextSelectRect[];
  }>;
}
/**
 * `<lr-code-block-core>` — a build-lean variant of `<lr-code-block>` for
 * a consumer whose `languages` map already covers every language it will
 * ever render. It only ever calls `loadShikiHighlighterCore(this.languages)`
 * (from the peer-neutral Shiki capability leaf) — never `loadShikiHighlighter()`, the default
 * ~200-language dynamic-import table loader `<lr-code-block>` calls. This component's own module never textually
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
 * and `scrollToAnchor()` resolves a `line-range` anchor. `activatable-lines` is a separate, purely
 * local affordance that turns the (`line-numbers`-gated) gutter into a keyboard-navigable,
 * clickable roving-tabindex group emitting `lr-line-activate` — it doesn't require `highlights` to
 * be set. If controlled `code` shrinks while a line owns focus, focus follows the clamped
 * surviving line through both plain and highlighted DOM replacement; an explicit move to another
 * control during the update is never overridden.
 *
 * @customElement lr-code-block-core
 * @event lr-copy - The raw `code` was written to the clipboard. Frozen detail:
 *   `{ ok: true, text }`.
 * @event lr-error - Clipboard writing failed; generic no-detail notification.
 * @event lr-copy-error - Clipboard writing failed. Frozen detail:
 *   `{ ok: false, text, reason, error }`, where `reason` is
 *   `'unsupported' | 'denied' | 'failed'`.
 * @event lr-toggle-request - Cancelable request emitted before collapse state changes.
 *   `detail: { collapsed }` is the proposed next state.
 * @event lr-toggle - The collapse/expand header button was activated.
 *   `detail: { collapsed }` — same event name and shape convention as
 *   `<lr-thinking-panel>`'s own `lr-toggle`.
 * @event lr-line-activate - A gutter line number was activated (click, or Enter/Space while
 *   focused) while `activatable-lines` is set. `detail: { line }`.
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
 * @csspart line-button - A gutter line-number button, only rendered while `activatable-lines` and
 *   `line-numbers` are both set.
 * @cssprop [--lr-code-block-max-height=none] - Scroll cap applied to `body`. The `max-height`
 *   attribute, when set, writes this same property inline on `body` and therefore wins.
 * @cssprop [--lr-code-block-font=var(--lr-font-mono)] - Monospace family for the rendered `pre`
 *   and `code`.
 * @cssprop [--lr-code-block-tab-size=2] - Tab width for the rendered code, applied to `pre`.
 *   Shared with `lr-code-block` (this component reuses its stylesheet), `lr-code-editor`, and
 *   the markdown viewers' own `code-block` part, so every code surface agrees on a tab's width.
 * @cssprop [--lr-code-block-active-line-outline-color=var(--lr-color-brand)] - Outline color of
 *   the line marked active by `active-highlight-id`, leaving every other `--lr-color-brand`
 *   surface in the component alone.
 * @cssprop [--lr-code-block-highlighted-line-bg=var(--lr-color-warning-quiet)] - Background color
 *   of a line marked by `highlight-lines` or a `line-range` entry in `highlights`. Shared with
 *   `lr-code-block` (this component reuses its stylesheet), leaving every other
 *   `--lr-color-warning-quiet` surface alone.
 * @status stable
 * @since 4.0.0
 */
export class LyraCodeBlockCore extends LyraElement<LyraCodeBlockCoreEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    codeBlockLineLabel: LYRA_DEFAULT_codeBlockLineLabel,
    codeRegion: LYRA_DEFAULT_codeRegion,
    codeRegionWithLanguage: LYRA_DEFAULT_codeRegionWithLanguage,
    collapseCode: LYRA_DEFAULT_collapseCode,
    copied: LYRA_DEFAULT_copied,
    copiedToClipboard: LYRA_DEFAULT_copiedToClipboard,
    copy: LYRA_DEFAULT_copy,
    copyCode: LYRA_DEFAULT_copyCode,
    copyFailed: LYRA_DEFAULT_copyFailed,
    expandCode: LYRA_DEFAULT_expandCode,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-text-select',
  ]);

  /** `languages` grammar objects are caller-owned data read only through Shiki's own APIs --
   *  bounded, detached, and frozen on assignment like every other public collection, so a later
   *  in-place mutation of a caller's grammar object can never silently change what this instance
   *  has already handed to `loadShikiHighlighterCore()`. */
  protected static override readonly ownedCollectionProperties = Object.freeze(['languages']);

  static override styles = [LyraElement.styles, styles];

  /** The raw source text. Removing the attribute renders an empty code block. */
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
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Whether the code region can be collapsed via a header toggle. */
  @property({ type: Boolean, reflect: true }) collapsible = false;

  /** Whether the code region is currently hidden. Only has a visible effect
   *  while `collapsible` is also true. */
  @property({ type: Boolean, reflect: true }) collapsed = false;

  /** Shows a copy-to-clipboard button in the header. */
  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  copyable = true;

  /** A CSS length (e.g. `"20rem"`); once set, the code scrolls internally
   *  past this height instead of growing the page. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Whether to display one-based line numbers beside the code. Highlighted gutters
   *  follow live locale and line-label string changes. */
  @property({ type: Boolean, attribute: 'line-numbers', reflect: true })
  lineNumbers = false;

  /** Comma-separated 1-based inclusive line ranges (e.g. `"3-5,7"`) to visually emphasize.
   *  Removing the attribute clears these ranges. Declarative sugar over `highlights` — merges with, and renders identically to, any
   *  `line-range` entries in `highlights`. */
  @property({ attribute: 'highlight-lines' }) highlightLines = '';

  /** Turns the (`line-numbers`-gated) gutter into a roving-tabindex group of buttons emitting
   *  `lr-line-activate`. Has no effect while `line-numbers` is unset. */
  @property({ type: Boolean, attribute: 'activatable-lines' })
  activatableLines = false;

  private _highlights: readonly LyraHighlight[] = snapshotLyraHighlights([]);
  /** Host-supplied highlights to paint over the code. Only `line-range` anchors are meaningful
   *  here — every other `LyraAnchor` kind, and a highlight with a missing, malformed, or
   *  non-discriminated anchor, is ignored (`snapshotLyraHighlights`).
   * @default [] */
  @property({ attribute: false })
  get highlights(): readonly LyraHighlight[] { return this._highlights; }
  set highlights(value: readonly LyraHighlight[]) {
    const previous = this._highlights;
    this._highlights = snapshotLyraHighlights(value);
    this.requestUpdate('highlights', previous);
  }

  /** The `highlights` entry, if any, currently treated as active (`data-active` on its lines). */
  @property({ attribute: 'active-highlight-id' }) activeHighlightId:
    | string
    | null = null;

  /** Anchor kinds this component resolves via `scrollToAnchor()`. */
  // Declaration quote style is part of the published API snapshot normalizer.
  // prettier-ignore
  readonly anchorKinds: readonly LyraAnchor['kind'][] = ['line-range'];

  @state() private focusedLine = 1;
  private restoreFocusedLineAfterUpdate = false;

  /** Grammar definitions this instance can highlight, e.g. `{ json: jsonGrammar }` (import from
   *  `shiki/langs/<name>.mjs`). This component has no default/full-table fallback highlighter --
   *  a `language` absent from this map always renders the plain-text fallback. Empty (the
   *  default) never highlights at all. Replacing the map starts a new loading generation; an
   *  older map that settles later cannot clear the current map's loading state or replace its
   *  highlighted output. For a TypeScript annotation, use `import type { ShikiLanguageInput } from
   *  '@aceshooting/lyra-ui/components/conversation/code-block/code-block-core.js'`; this granular
   *  type-only import emits no registration side effect. */
  @property({ attribute: false }) languages: Readonly<Record<
    string,
    ShikiLanguageInput
  >> = {};

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

  @state() private copyFailed = false;

  @state() private isDarkTheme = false;

  // Every interaction behavior this component and <lr-code-block> implement identically -- the
  // gutter's roving tabindex and keyboard contract, the [part="body"] handlers, selection
  // anchoring, copy + its confirmation timer, the collapse toggle, and the theme watcher. Shared
  // so a fix to any of it lands once instead of needing to be applied to both class files.
  private readonly interactions = new CodeBlockInteractionController({
    host: this,
    setFocusedLine: (line) => {
      this.focusedLine = line;
    },
    setJustCopied: (value) => {
      this.justCopied = value;
    },
    setCopyFailed: (value) => {
      this.copyFailed = value;
    },
    setDarkTheme: (value) => {
      this.isDarkTheme = value;
    },
    emitLineActivate: (line) => this.emit('lr-line-activate', { line }),
    emitCopy: (outcome) => this.emit('lr-copy', outcome),
    emitError: () => this.emit('lr-error', null),
    emitCopyError: (outcome) => this.emit('lr-copy-error', outcome),
    requestToggle: (collapsed) =>
      !this.emit('lr-toggle-request', { collapsed }, { cancelable: true })
        .defaultPrevented,
    emitToggle: (collapsed) => this.emit('lr-toggle', { collapsed }),
    emitTextSelect: (selection) => this.emit('lr-text-select', selection),
  });

  // Guards the async per-language load in syncHighlight() against a
  // `code`/`language` change that arrives before a previous load resolves --
  // only the result matching the *current* token is ever applied.
  private highlightToken = 0;

  // Identifies the active `languages` object across both the eager connected load and
  // syncHighlight()'s result path. A disconnect/reconnect or map replacement starts a new
  // generation, so an older cached promise can never mark the current map ready.
  private highlighterGeneration = 0;
  private activeLanguages?: Record<string, ShikiLanguageInput>;

  private readonly bodyId = nextId('code-block-body');

  constructor() {
    super();
    new ThemeWatcher(this, () => this.refreshTheme());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.refreshTheme();
    const languages = this.languages;
    const generation = this.activateLanguages(languages);
    if (Object.keys(languages).length === 0) return;
    void loadShikiHighlighterCore(languages).then(() => {
      // loadShikiHighlighterCore() is a shared, cached-by-languages promise --
      // it can resolve well after this element has disconnected (or been torn
      // down for good). Bail out rather than mutate @state on a dead instance
      // and kick off syncHighlight()'s own further async grammar load for
      // nothing. Mirrors chart.ts's/markdown.ts's/lr-code-block's identical
      // connectedCallback() guard for the same race.
      if (
        !this.isConnected ||
        generation !== this.highlighterGeneration ||
        languages !== this.languages
      )
        return;
      this.shikiReady = true;
      this.syncHighlight();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.interactions.disconnect();
    this.activeLanguages = undefined;
    this.highlighterGeneration += 1;
    this.highlightToken += 1;
    this.shikiReady = false;
    this.highlightedHtml = null;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // A node can move between owner documents while already disconnected; always retire an
    // old-realm confirmation timer even when no further disconnect callback will run.
    this.interactions.disconnect();
  }

  // The `languages` entry for the *current* `language`, if any -- shared by
  // `willUpdate()`/`updated()`/`render()`/`syncHighlight()` so they all agree
  // on whether this language is highlightable at all.
  private preSuppliedGrammar(): ShikiLanguageInput | undefined {
    return codeBlockPreSuppliedGrammar(this.languages, this.language ?? '');
  }

  private lineHighlightSet(): Set<number> {
    return codeBlockLineHighlightSet(
      this.highlightLines ?? '',
      this.highlights,
      this.lineCount()
    );
  }

  private activeHighlightLineSet(): Set<number> {
    return codeBlockActiveHighlightLineSet(
      this.highlights,
      this.activeHighlightId,
      this.lineCount()
    );
  }

  private lineCount(): number {
    return codeBlockLineCount(this.code ?? '');
  }

  /** Resolves a `line-range` anchor (or a `highlights` id string resolving to one) by scrolling
   *  its start line into view within `[part="body"]`. Resolves `false` when the anchor isn't a
   *  `line-range`, the id isn't found, or the start line is out of bounds. */
  async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    return scrollCodeBlockToAnchor(this, target);
  }

  /** Recomputes Shiki palette selection after an imperative CSSOM theme change. */
  refreshTheme(): void {
    this.interactions.refreshTheme();
  }

  // Mutating `highlightedHtml` here (rather than in `updated()`) absorbs the
  // synchronous case -- language already loaded, see `syncHighlight()` --
  // into this same update cycle instead of scheduling a second one, Lit's
  // documented pattern for deriving one reactive property from a change to
  // others (same approach <lr-markdown>'s `willUpdate` takes).
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run -- <lr-code-block> has always chained
    // here and this variant silently didn't, the exact drift code-block-shared.ts exists to end.
    this.restoreFocusedLineAfterUpdate = codeBlockLineHasFocus(this);
    if (changed.has('code')) {
      this.focusedLine = clampCodeBlockFocusedLine(
        this.focusedLine,
        this.lineCount()
      );
    }
    if (changed.has('languages')) this.activateLanguages(this.languages);
    if (!this.interactions.needsHighlightResync(
      changed,
      this.effectiveLocale,
      this.localize('codeBlockLineLabel'),
    )) return;
    if (this.shikiReady || this.preSuppliedGrammar()) {
      this.syncHighlight();
    } else {
      this.highlightedHtml = null;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // see willUpdate() above -- same chain-up, same reason.
    applyCodeBlockAriaBusy(this, this.showsSkeleton());
    if (this.restoreFocusedLineAfterUpdate) {
      restoreCodeBlockLineFocus(this, this.focusedLine);
      this.restoreFocusedLineAfterUpdate = false;
    }
  }

  /** Whether this render shows the loading skeleton instead of the code. Unlike `<lr-code-block>`,
   *  the only highlighter this variant ever waits on is the fine-grained one seeded from
   *  `languages` -- so a `language` absent from that map has nothing pending and never shows the
   *  skeleton. Read by both `updated()` and `render()` so the `aria-busy` host attribute can never
   *  disagree with what's on screen. */
  private showsSkeleton(): boolean {
    return codeBlockShowsSkeleton(
      this.shikiReady,
      this.language,
      !!this.preSuppliedGrammar()
    );
  }

  private activateLanguages(
    languages: Record<string, ShikiLanguageInput>
  ): number {
    if (this.activeLanguages === languages) return this.highlighterGeneration;
    this.activeLanguages = languages;
    this.highlighterGeneration += 1;
    this.highlightToken += 1;
    this.shikiReady = false;
    this.highlightedHtml = null;
    return this.highlighterGeneration;
  }

  private syncHighlight(): void {
    // Bumped unconditionally -- on *every* call, not just the async branch
    // below -- so that a call landing on the synchronous already-loaded
    // branch still invalidates any earlier in-flight load from a previous
    // call. Without this, a load kicked off by an older call can resolve
    // after a newer call has already rendered correct synchronous output,
    // and overwrite it with stale tokenization.
    const languages = this.languages;
    const generation = this.activateLanguages(languages);
    const token = ++this.highlightToken;
    const lang = normalizeShikiLanguage(this.language ?? '');
    if (!lang) {
      this.highlightedHtml = null;
      return;
    }

    if (!languages?.[lang] && !languages?.[this.language]) {
      // Not in the supplied languages map -- there is no default
      // highlighter to fall back to in this variant, so this always
      // renders the plain-text fallback, unlike <lr-code-block>'s
      // dynamic-import path for an unmapped language.
      this.highlightedHtml = null;
      return;
    }

    // Mirrors <lr-code-block>'s own fine-grained branch: calls
    // loadShikiHighlighterCore() directly rather than caching a highlighter
    // on the instance -- `languages` may be supplied any time after
    // `connectedCallback()` already ran (e.g. set as a property right after
    // creation), so this can't rely solely on that one-time eager load.
    // loadShikiHighlighterCore() itself caches by `languages` object
    // identity, so a call here that lands on the same map
    // connectedCallback() already kicked off just resolves the shared
    // cached promise instead of loading twice.
    this.highlightedHtml = null;
    void loadShikiHighlighterCore(languages).then((hl) => {
      if (token !== this.highlightToken) return; // superseded by a newer code/language/languages change
      if (
        generation !== this.highlighterGeneration ||
        languages !== this.languages
      )
        return;
      // Lit's first update cycle (which is what calls syncHighlight() via
      // willUpdate() for an element that had `language`/`languages` set
      // before it ever connected) still runs even if the element disconnects
      // in the same synchronous tick as connectedCallback(), before that
      // first update's microtask fires -- so this needs its own isConnected
      // guard alongside connectedCallback()'s, not just the staleness check
      // above, to avoid mutating @state on a dead instance.
      if (!this.isConnected) return;
      this.shikiReady = true;
      this.highlightedHtml = hl ? this.tokenize(hl, lang) : null;
    });
  }

  private tokenize(hl: ShikiHighlighterCore, lang: string): string | null {
    return tokenizeCodeBlock(hl, {
      code: this.code ?? '',
      lang,
      lineNumbers: this.lineNumbers,
      activatableLines: this.activatableLines,
      focusedLine: this.focusedLine,
      highlightedLines: this.lineHighlightSet(),
      activeLines: this.activeHighlightLineSet(),
      lineLabel: (line) =>
        this.localize('codeBlockLineLabel', undefined, {
          line: getNumberFormat(this.effectiveLocale).format(line),
        }),
      lineNumberText: (line) =>
        getNumberFormat(this.effectiveLocale).format(line),
    });
  }

  // Delegates to the shared renderCodeBlockPlainCode() in code-block-shared.ts -- previously a
  // byte-for-byte-duplicated private method also defined on <lr-code-block>, moved out to stop
  // that pair's plain-text-fallback rendering from silently drifting apart. See that function's
  // own doc for the rendering behavior.
  private renderPlainCode(): TemplateResult {
    return renderCodeBlockPlainCode({
      code: this.code ?? '',
      lineNumbers: this.lineNumbers,
      activatableLines: this.activatableLines,
      focusedLine: this.focusedLine,
      highlightedLines: this.lineHighlightSet(),
      activeLines: this.activeHighlightLineSet(),
      localize: this.localize.bind(this),
      lineLabel: (line) =>
        this.localize('codeBlockLineLabel', undefined, {
          line: getNumberFormat(this.effectiveLocale).format(line),
        }),
      lineNumberText: (line) =>
        getNumberFormat(this.effectiveLocale).format(line),
      onLineActivate: (line) => this.interactions.onLineActivate(line),
      onLineKeyDown: (e, line) => this.interactions.onLineKeyDown(e, line),
    });
  }

  // The header row and the whole body/skeleton/`<pre>` shell come from
  // renderCodeBlockShell() in code-block-shared.ts -- see that function's own
  // doc for the `[part="body"]` tabindex/role rationale. Both were previously
  // duplicated verbatim from <lr-code-block>.
  override render(): TemplateResult {
    return renderCodeBlockShell({
      filename: this.filename,
      language: this.language,
      copyable: this.copyable,
      collapsible: this.collapsible,
      collapsed: this.collapsed,
      justCopied: this.justCopied,
      copyFailed: this.copyFailed,
      bodyId: this.bodyId,
      accessibleLabel: this.accessibleLabel,
      maxHeight: this.maxHeight,
      isDarkTheme: this.isDarkTheme,
      showSkeleton: this.showsSkeleton(),
      highlightedHtml: this.highlightedHtml,
      lineNumbers: this.lineNumbers,
      localize: this.localize.bind(this),
      renderPlainCode: () => this.renderPlainCode(),
      onToggle: this.interactions.toggleCollapsed,
      onCopy: this.interactions.copy,
      onBodyMouseUp: this.interactions.onBodyMouseUp,
      onBodyClick: this.interactions.onBodyClick,
      onBodyKeyDown: this.interactions.onBodyKeyDown,
      onBodyFocusIn: this.interactions.onBodyFocusIn,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-code-block-core': LyraCodeBlockCore;
  }
}
