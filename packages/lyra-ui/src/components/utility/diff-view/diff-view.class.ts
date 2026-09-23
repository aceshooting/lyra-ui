import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { acquireAnnouncementSink, Announcer, type AnnouncementSink } from '../../../internal/announcer.js';
import { announceSearchResult } from '../../../internal/viewer-search.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteCount } from '../../../internal/numbers.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import {
  writeClipboardText,
  type LyraClipboardWriteFailure,
  type LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import { DocumentAnchorTarget, prioritizedHighlightCandidates } from '../../../internal/anchor-target.js';
import type {
  AnchorResultDetail,
  HighlightActivateDetail,
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
} from '../../viewers/document-viewer/anchors.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from '../../viewers/viewer-search-limits.js';
import { ViewerAnnouncementController } from '../../viewers/viewer-announcements.js';
import { computeLineDiff, pairOpsForSplit, type LyraDiffOp, type LyraDiffSplitRow } from './diff-line-diff.js';
import {
  loadShikiHighlighterCore,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from '../../conversation/code-block/code-loader.js';
import { styles } from './diff-view.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copied, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyDiff, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_details, LYRA_DEFAULT_diffViewHiddenLines, LYRA_DEFAULT_diffViewNewLabel, LYRA_DEFAULT_diffViewOldLabel, LYRA_DEFAULT_diffViewTooLarge, LYRA_DEFAULT_highlightOfTotal, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_remove, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** How long the "Copied!" confirmation state lasts before reverting -- matches
 *  `lr-copy-button`'s own `COPY_CONFIRM_MS`. */
const COPY_CONFIRM_MS = 1500;

type CopyStatus = 'rest' | 'success' | 'error';

/** Split into logical lines while normalizing all three line-ending conventions (CRLF, lone CR,
 *  LF). A raw `text.split('\n')` leaves a trailing `\r` on every CRLF line -- which makes two files
 *  that differ only in line endings diff as entirely changed, corrupts the emitted `lr-copy`
 *  payload, and (with `white-space: pre-wrap`) renders a spurious blank line after each row -- and
 *  collapses a lone-CR (classic-Mac) document into a single giant line. Used at BOTH the diff and
 *  the shiki-tokenize call sites so their line counts stay in lockstep. */
const splitLines = (text: string): string[] =>
  text === '' ? [] : text.split(/\r\n|\r|\n/);

// Line count alone does not bound Hirschberg's O(n*m) work or the strings handed to the
// highlighter. These ceilings apply even when maxLines is explicitly relaxed.
const MAX_DIFF_CHARACTERS = 1_000_000;
const MAX_DIFF_COMPARISONS = 4_000_000;
const MAX_DIFF_LANGUAGES = 10_000;
const MAX_DIFF_LANGUAGE_INSPECTIONS = MAX_DIFF_LANGUAGES * 2;
/** A search match currently identifies a rendered line (diff op), not a character range within
 *  it -- mirrors `<lr-csv-viewer>`'s per-cell match granularity. Keeps retained matches bounded
 *  independent of how many times a query recurs within one adversarially long line. */
const MAX_SEARCH_MATCHES = 10_000;
/** Bounds `highlights` resolution work independent of how many entries a host supplies. */
const MAX_PAINTED_HIGHLIGHTS = 100;

/** One `search()` match: the 0-based index into `this.diffOps` of a line whose text contains the
 *  query. */
interface DiffSearchMatch {
  opIndex: number;
}

/** Copies grammar-map entries through data descriptors so optional loading never invokes a
 * consumer accessor while it discovers the requested language. Grammar values stay opaque. */
function projectLanguages(value: unknown): Record<string, ShikiLanguageInput> | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  try {
    if (Array.isArray(value)) return undefined;
    const projected = Object.create(null) as Record<string, ShikiLanguageInput>;
    // Own-name discovery avoids Object.keys()/for-in's implicit enumerable-descriptor probe, so
    // one hostile Proxy descriptor cannot hide a later valid grammar. Structural reflection and
    // admitted enumerable grammars have separate limits: opaque/non-enumerable names never spend
    // an admission slot, while the total descriptor walk remains bounded.
    const keys = Object.getOwnPropertyNames(value);
    let inspected = 0;
    let admitted = 0;
    for (const key of keys) {
      if (inspected >= MAX_DIFF_LANGUAGE_INSPECTIONS || admitted >= MAX_DIFF_LANGUAGES) break;
      inspected += 1;
      const descriptor = getOwnDataDescriptor(value, key);
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
        !descriptor.enumerable
      )
        continue;
      Object.defineProperty(projected, key, {
        value: descriptor.value as ShikiLanguageInput,
        enumerable: true,
        configurable: false,
        writable: false,
      });
      admitted += 1;
    }
    return Object.freeze(projected);
  } catch {
    return undefined;
  }
}

export interface LyraDiffViewEventMap {
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  /** A `highlights` entry's `[part="line-highlight-action"]` button was clicked or activated via
   *  Enter/Space. */
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  /** Fired after an `anchor` property assignment or a `scrollToAnchor()` call is applied. */
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
}

/** The internal diff rendering layout -- `'unified'` (the default) is one interleaved column,
 *  `'split'` is two side-by-side columns derived from the same `LyraDiffOp[]`. */
export type LyraDiffViewLayout = 'unified' | 'split';

const DIFF_VIEW_LAYOUT = literalSetConverter<LyraDiffViewLayout>(
  ['unified', 'split'],
  'unified'
);

// Same one-line base every other `DocumentAnchorTarget()` adopter uses: the mixin takes a
// constructor, so the event map has to be bound before it is applied -- otherwise this component
// keeps `LyraElement`'s permissive default and its own `emit()` calls go unchecked.
class LyraDiffViewBase extends LyraElement<LyraDiffViewEventMap> {}

/**
 * `<lr-diff-view>` — a real two-string line diff (Hirschberg LCS alignment), rendered as
 * interleaved unified-diff output -- not diff-flavored syntax highlighting over an
 * already-formatted string (`lr-code-block`'s `language="diff"` only lexically colors a string
 * the consumer already unified-diffed; it has no two-string-compare entry point). First-party
 * invention (no Web Awesome equivalent).
 *
 * Adopts `DocumentAnchorTarget`: a `line-range` anchor addresses the 0-based index into the
 * rendered diff's own op sequence (`start`; an optional `end` covers a multi-line range for
 * `highlights`) -- not an old-file/new-file source line number, since those diverge on any
 * insertion or deletion. `scrollToAnchor()` resolves it, transparently expanding (and, for
 * `highlights`, painting through) any `contextLines` fold that currently hides the target run
 * rather than leaving it inaccessible behind a static marker. `search()` is a locale-aware
 * case-insensitive substring match over each rendered line's own text, one match per line
 * ordered by that same op index, built on the shared bounded viewer-search budget and
 * `internal/viewer-search.ts`'s `announceSearchResult()`.
 *
 * @customElement lr-diff-view
 * @event lr-copy - Fired after clipboard writing fulfills. The frozen shared outcome detail is
 *   `{ ok: true, text }`, where `text` is the full unified diff.
 * @event lr-error - The clipboard write failed. A bubbling, composed, non-cancelable event with
 *   no detail.
 * @event lr-copy-error - The clipboard write failed. The frozen shared outcome detail is
 *   `{ ok: false, text, reason, error }`, where
 *   `reason` is `'unsupported' | 'denied' | 'failed'`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes. `detail: { query, matchCount, matchCountExact, activeIndex }`. Search accepts at
 *   most 4,096 query code units, scans at most 4,000,000 line code units, and retains at most
 *   10,000 matches; `matchCountExact=false` identifies a ceiling-truncated lower bound.
 * @event lr-highlight-activate - A `highlights` entry's `[part="line-highlight-action"]` button
 *   was clicked or activated via Enter/Space. `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart base - The root wrapper.
 * @csspart line - A single line. Carries `data-type="equal"|"add"|"remove"|"empty"|"fold"`
 *   (`"empty"` is an unbalanced-replace placeholder cell in `layout="split"` and never carries a
 *   `+`/`-` prefix; `"fold"` is the collapsed-unchanged-lines marker `contextLines` produces),
 *   `data-match`/`data-active-match` while a search result covers it, and `data-highlight`
 *   (the resolved tone, default `accent`) plus `data-active-highlight` while a `highlights` entry
 *   covers it.
 * @csspart line-highlight-action - The focusable button a resolved `highlights` entry adds to the
 *   line it first covers; emits `lr-highlight-activate`.
 * @csspart copy-button - The copy affordance, only rendered while `copyable`.
 * @csspart limit - The localized fallback rendered when either input exceeds `maxLines`.
 * @csspart side - One column in `layout="split"` (`data-side="old"|"new"`).
 * @csspart anchor-live-region - An aria-hidden, non-live shadow mirror of the latest anchor-jump
 *   message; the spoken copy is appended to the shared document-level polite sink only while this
 *   viewer and its composed ancestors are exposed to the accessibility tree.
 * @cssprop [--lr-diff-view-max-height=none] - Cap on `[part="base"]`'s block size, past which the
 *   view scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @cssprop [--lr-diff-view-font=var(--lr-font-mono)] - Font family used for the diff lines.
 * @cssprop [--lr-diff-view-add-background=var(--lr-color-success-quiet)] - Added-line background.
 * @cssprop [--lr-diff-view-add-color=var(--lr-color-success)] - Added-line text color.
 * @cssprop [--lr-diff-view-remove-background=var(--lr-color-danger-quiet)] - Removed-line background.
 * @cssprop [--lr-diff-view-remove-color=var(--lr-color-danger)] - Removed-line text color.
 * @cssprop [--lr-diff-view-fold-background=var(--lr-color-surface-raised)] - Fold-marker background.
 * @cssprop [--lr-diff-view-fold-color=var(--lr-color-text-quiet)] - Fold-marker text color.
 * @cssprop [--lr-diff-view-match-color=var(--lr-color-warning)] - Outline color of a line
 *   containing a non-active search match.
 * @cssprop [--lr-diff-view-active-match-color=var(--lr-color-warning)] - Outline color of the
 *   line containing the active search match.
 * @cssprop [--lr-diff-view-highlight-accent-background=var(--lr-color-brand-quiet)] - Background
 *   of an `accent`-tone (the default) `highlights` line.
 * @cssprop [--lr-diff-view-highlight-success-background=var(--lr-color-success-quiet)] -
 *   Background of a `success`-tone `highlights` line.
 * @cssprop [--lr-diff-view-highlight-warning-background=var(--lr-color-warning-quiet)] -
 *   Background of a `warning`-tone `highlights` line.
 * @cssprop [--lr-diff-view-highlight-danger-background=var(--lr-color-danger-quiet)] -
 *   Background of a `danger`-tone `highlights` line.
 * @cssprop [--lr-diff-view-highlight-neutral-background=var(--lr-color-surface-raised)] -
 *   Background of a `neutral`-tone `highlights` line.
 * @cssprop [--lr-diff-view-highlight-active-outline=var(--lr-color-brand)] - Outline of the line
 *   whose covering highlight is `activeHighlightId`.
 * @status stable
 * @since 4.0.0
 */
export class LyraDiffView extends DocumentAnchorTarget(LyraDiffViewBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    collapse: LYRA_DEFAULT_collapse,
    copied: LYRA_DEFAULT_copied,
    copy: LYRA_DEFAULT_copy,
    copyDiff: LYRA_DEFAULT_copyDiff,
    copyFailed: LYRA_DEFAULT_copyFailed,
    details: LYRA_DEFAULT_details,
    diffViewHiddenLines: LYRA_DEFAULT_diffViewHiddenLines,
    diffViewNewLabel: LYRA_DEFAULT_diffViewNewLabel,
    diffViewOldLabel: LYRA_DEFAULT_diffViewOldLabel,
    diffViewTooLarge: LYRA_DEFAULT_diffViewTooLarge,
    highlightOfTotal: LYRA_DEFAULT_highlightOfTotal,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    remove: LYRA_DEFAULT_remove,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    viewerSearchActiveMatch: LYRA_DEFAULT_viewerSearchActiveMatch,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    viewerSearchNoMatches: LYRA_DEFAULT_viewerSearchNoMatches,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** The "before" text. Default `''` renders an all-additions diff of `newText`. */
  @property({ attribute: false }) oldText = '';

  /** The "after" text. Default `''` renders an all-removals diff of `oldText`. */
  @property({ attribute: false }) newText = '';

  /** Shows a copy-to-clipboard button for the full unified-diff text. `false` (the default)
   *  renders no button. */
  @property({ type: Boolean }) copyable = false;

  /** A CSS length (e.g. `"20rem"`); once set, the view scrolls internally past this height
   *  instead of growing the page. Invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** `'unified'` (the default) renders today's single interleaved `<pre>`; `'split'` renders two
   *  side-by-side columns derived from the same `LyraDiffOp[]` (see `pairOpsForSplit()`).
   *  Unsupported attributes and untyped writes normalize to reflected `unified`. */
  private _layout: LyraDiffViewLayout = 'unified';

  @property({ reflect: true, converter: DIFF_VIEW_LAYOUT })
  get layout(): LyraDiffViewLayout {
    return this._layout;
  }
  set layout(next: LyraDiffViewLayout) {
    const normalized = DIFF_VIEW_LAYOUT.normalizeReflected(
      this,
      'layout',
      next
    );
    const old = this._layout;
    if (old === normalized) return;
    this._layout = normalized;
    this.requestUpdate('layout', old);
  }

  /** A shiki-recognized language id. Highlighting activates only when this has a matching entry in
   *  `languages` -- there is deliberately no default full-table `lr-code-block`-style fallback, so
   *  this component never reaches shiki's ~200-language dynamic-import table. */
  @property() language = '';

  /** Grammar definitions this instance can highlight, same shape as `lr-code-block-core`'s own
   *  `languages`. */
  @property({ attribute: false }) languages?: Readonly<
    Record<string, ShikiLanguageInput>
  >;

  /** How many unchanged lines to keep visible immediately before/after each change. Default
   *  `undefined` renders every line unconditionally, exactly like before this property existed. Set
   *  to a finite number `>= 0` to collapse a longer run of unchanged lines behind a single fold
   *  marker reporting how many lines it hides -- the same context-window convention unified diffs
   *  and `git diff`'s `-U<n>` use. A negative or non-finite value is treated as unset (no folding). */
  @property({ type: Number, attribute: 'context-lines' }) contextLines?: number;

  /** Maximum lines accepted on either input side before rendering a bounded fallback. Defaults
   *  to `5000`. `Infinity` relaxes this line-count limit; aggregate text and comparison work
   *  remain bounded. */
  @property({ type: Number, attribute: 'max-lines' }) maxLines = 5000;

  /** Anchor kinds this component resolves via `scrollToAnchor()`. Feature-detectable capability
   *  mirror -- the same pattern every other `DocumentAnchorTarget`-adopting viewer uses for this
   *  field. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['line-range'];

  @state() private copyStatus: CopyStatus = 'rest';
  @state() private diffTooLarge = false;

  /** Copy outcomes announce through a light-DOM sink because live regions inside shadow roots are
   * not consistently exposed by assistive technology. */
  private copyAnnouncementSink?: AnnouncementSink;

  @state() private searchMatches: DiffSearchMatch[] = [];
  private searchMatchCountExact = true;
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private lastSearchLocale = '';
  private pendingSearchResetEvent = false;
  /** Diff ops a `scrollToAnchor()`/search navigation revealed out of a `contextLines` fold --
   *  the whole equal-run one of them belongs to renders unfolded instead of behind its marker.
   *  Reset whenever `diffOps` itself is recomputed (the previous ops are no longer reachable). */
  @state() private forcedVisibleOps: ReadonlySet<LyraDiffOp> = new Set();
  private readonly searchAnnouncements = new ViewerAnnouncementController(this);
  private readonly searchAnnouncer = new Announcer({
    onFlush: (text) => this.searchAnnouncements.announcePolite(text),
  });

  @state() private highlightedOldLines: string[] | null = null;
  @state() private highlightedNewLines: string[] | null = null;
  private highlightToken = 0;
  private loadHighlighterCore: (languages: Record<string, ShikiLanguageInput>) => Promise<ShikiHighlighterCore | null> =
    loadShikiHighlighterCore;

  private copyTimer?: { owner: Window; handle: number; generation: number };
  /** Invalidates clipboard outcomes when another activation, source change, disconnect, or
   * adoption makes the pending write obsolete. */
  private copyGeneration = 0;

  /** Canonical scalar text and grammar-map inputs. Every later diff/highlight read uses these
   * admitted values instead of re-reading caller-owned public properties. */
  private oldTextSnapshot = '';
  private newTextSnapshot = '';
  private languageSnapshot = '';
  private languagesSnapshot?: Record<string, ShikiLanguageInput>;

  // The O(n*m) LCS computation only needs rerunning when the compared texts or their ceiling
  // changes. A render triggered purely by copy feedback toggling reuses the same result.
  private diffOps: LyraDiffOp[] = [];
  /** O(1) reverse lookup from an op reference (rendered as `[part="line"]`, in both unified and
   *  split layouts, since both derive from this same array) to its stable 0-based `line-range`
   *  anchor index. Rebuilt in lockstep with `diffOps` -- every op is a fresh object literal each
   *  recompute, so a stale entry can never alias a same-shaped later op. */
  private opIndexMap = new Map<LyraDiffOp, number>();

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated || changed.has('oldText') || changed.has('newText')) {
      const oldText = this.oldText;
      const newText = this.newText;
      this.oldTextSnapshot = typeof oldText === 'string' ? oldText : '';
      this.newTextSnapshot = typeof newText === 'string' ? newText : '';
    }
    if (!this.hasUpdated || changed.has('language') || changed.has('languages')) {
      const language = this.language;
      this.languageSnapshot = typeof language === 'string' ? language : '';
      this.languagesSnapshot = projectLanguages(this.languages);
    }
    if (
      this.hasUpdated &&
      (changed.has('oldText') || changed.has('newText') || changed.has('copyable') || changed.has('maxLines'))
    ) {
      this.resetCopyFeedback();
    }
    if (changed.has('oldText') || changed.has('newText') || changed.has('maxLines')) {
      const oldLines = splitLines(this.oldTextSnapshot);
      const newLines = splitLines(this.newTextSnapshot);
      const maxLines =
        this.maxLines === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : finiteCount(this.maxLines, 5000);
      const characterCount = this.oldTextSnapshot.length + this.newTextSnapshot.length;
      const comparisons = oldLines.length * newLines.length;
      this.diffTooLarge =
        oldLines.length > maxLines ||
        newLines.length > maxLines ||
        characterCount > MAX_DIFF_CHARACTERS ||
        comparisons > MAX_DIFF_COMPARISONS;
      this.diffOps = this.diffTooLarge ? [] : computeLineDiff(oldLines, newLines);
      this.opIndexMap = new Map(this.diffOps.map((op, index) => [op, index]));
      // Every op above is a fresh object literal, so a previously forced-visible/matched op can
      // never alias one in the new array -- both reset alongside it.
      this.pendingSearchResetEvent ||= this.hasSearchState();
      this.forcedVisibleOps = new Set();
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
    }
    if (
      changed.has('oldText') ||
      changed.has('newText') ||
      changed.has('language') ||
      changed.has('languages') ||
      changed.has('maxLines')
    ) {
      this.syncHighlight();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // reaches DocumentAnchorTarget's own live-region wiring
    if (this.pendingSearchResetEvent) {
      this.pendingSearchResetEvent = false;
      this.emitSearchChange();
    }
    const locale = this.effectiveLocale;
    if (locale !== this.lastSearchLocale) {
      const shouldRecompute = !!this.searchQuery;
      this.lastSearchLocale = locale;
      if (shouldRecompute)
        this.scheduleAfterUpdate(() => {
          void this.search(this.searchQuery);
        }, 'search');
    }
  }

  private hasSearchState(): boolean {
    return (
      this.searchQuery !== '' ||
      this.searchMatches.length > 0 ||
      !this.searchMatchCountExact ||
      this.searchActiveIndex !== -1
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.copyAnnouncementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.searchAnnouncements.connect();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.searchAnnouncer.setTimerHost(ownerWindow);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback(); // reaches DocumentAnchorTarget's own cleanup (anchor retry)
    this.resetCopyFeedback();
    this.copyAnnouncementSink?.release();
    this.copyAnnouncementSink = undefined;
    this.searchAnnouncer.cancel();
    this.searchAnnouncements.disconnect();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // A disconnected node can be adopted without receiving another disconnect notification.
    this.resetCopyFeedback();
    this.copyAnnouncementSink?.release();
    this.copyAnnouncementSink = undefined;
    this.searchAnnouncements.adopted();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.searchAnnouncer.setTimerHost(ownerWindow);
  }

  private cancelCopyTimer(): void {
    const timer = this.copyTimer;
    this.copyTimer = undefined;
    if (timer) timer.owner.clearTimeout(timer.handle);
  }

  private resetCopyFeedback(): void {
    this.copyGeneration += 1;
    this.cancelCopyTimer();
    this.copyStatus = 'rest';
  }

  private syncHighlight(): void {
    const token = ++this.highlightToken;
    if (this.diffTooLarge) {
      this.highlightedOldLines = null;
      this.highlightedNewLines = null;
      return;
    }
    const lang = this.languageSnapshot;
    const languages = this.languagesSnapshot;
    if (!lang || !languages || !Object.hasOwn(languages, lang)) {
      this.highlightedOldLines = null;
      this.highlightedNewLines = null;
      return;
    }
    let loading: Promise<ShikiHighlighterCore | null>;
    try {
      loading = this.loadHighlighterCore(languages);
    } catch {
      this.highlightedOldLines = null;
      this.highlightedNewLines = null;
      return;
    }
    void loading.then(
      (hl) => {
        if (token !== this.highlightToken) return; // superseded by a newer oldText/newText/language/languages change
        if (!hl) {
          this.highlightedOldLines = null;
          this.highlightedNewLines = null;
          return;
        }
        this.highlightedOldLines = this.tokenizeLines(hl, this.oldTextSnapshot, lang);
        this.highlightedNewLines = this.tokenizeLines(hl, this.newTextSnapshot, lang);
      },
      () => {
        if (token !== this.highlightToken) return;
        this.highlightedOldLines = null;
        this.highlightedNewLines = null;
      },
    );
  }

  /** Tokenizes `text` as one document (so multi-line tokens survive) and splits shiki's own
   *  rendered `.line` spans back into a per-source-line HTML array, normalized to exactly
   *  `splitLines(text).length` entries -- shiki's own trailing-newline handling can otherwise be
   *  off by one relative to a plain split. MUST use the same `splitLines` as the diff at
   *  `willUpdate` above: if this counted lines differently (e.g. plain `split('\n')` while the diff
   *  normalizes CRLF), every CRLF document would misindex `highlightedOldLines`/`-NewLines`. */
  private tokenizeLines(hl: ShikiHighlighterCore, text: string, lang: string): string[] | null {
    try {
      const html = hl.codeToHtml(text, { lang, themes: SHIKI_THEMES });
      const DOMParserCtor = this.ownerDocument.defaultView?.DOMParser;
      if (!DOMParserCtor) return null;
      const doc = new DOMParserCtor().parseFromString(html, 'text/html');
      const lines = Array.from(doc.querySelectorAll('code > .line')).map((line) => line.innerHTML);
      const expected = splitLines(text).length;
      while (lines.length > expected) lines.pop();
      while (lines.length < expected) lines.push('');
      return lines;
    } catch {
      // Malformed input for this grammar, or any other shiki-internal failure -- fall back to
      // plain text rather than a blank diff.
      return null;
    }
  }

  /** Computes which `equal` ops a fold marker should hide, keyed by object identity (not array
   *  index) so the same result works for both `renderUnified()`'s flat op sequence and
   *  `renderSplit()`'s `pairOpsForSplit()` rows -- an equal op's `LyraDiffOp` object is the exact same
   *  reference in both places. `foldBefore` maps the first visible op *after* a hidden run to how
   *  many lines that run hid (the marker renders immediately before that op); a run hidden all the
   *  way to the end of the diff has no "next op" to key off, so its count surfaces separately as
   *  `trailingFold`. Only maximal `equal` runs are ever folded -- `add`/`remove` ops are always
   *  visible. A run that is both the very first and very last thing in the diff (i.e. `oldText` and
   *  `newText` are identical) is never folded: there is no adjacent change to give context around. */
  private computeFolds(): {
    visible: Set<LyraDiffOp>;
    foldBefore: Map<LyraDiffOp, number>;
    trailingFold: number;
  } {
    const ops = this.diffOps;
    const visible = new Set<LyraDiffOp>(ops);
    const foldBefore = new Map<LyraDiffOp, number>();
    let trailingFold = 0;
    const ctx =
      this.contextLines == null || !Number.isFinite(this.contextLines) || this.contextLines < 0
        ? undefined
        : finiteCount(this.contextLines);
    if (ctx === undefined) return { visible, foldBefore, trailingFold };
    let i = 0;
    while (i < ops.length) {
      if (ops[i]!.type !== 'equal') {
        i++;
        continue;
      }
      let j = i;
      while (j < ops.length && ops[j]!.type === 'equal') j++;
      const runLength = j - i;
      const isLeading = i === 0;
      const isTrailing = j === ops.length;
      let runHasForcedReveal = false;
      if (this.forcedVisibleOps.size > 0) {
        for (let k = i; k < j; k++) {
          if (this.forcedVisibleOps.has(ops[k]!)) {
            runHasForcedReveal = true;
            break;
          }
        }
      }
      if (isLeading && isTrailing) {
        // Nothing changed anywhere in the diff -- show it all, there's no change to fold around.
      } else if (runHasForcedReveal) {
        // A scrollToAnchor()/search() navigation target (or, for a multi-line highlight, any op it
        // covers) landed inside this run -- show the whole run instead of computing a fold, so the
        // target is never left stranded behind a marker with no expand affordance.
      } else if (isLeading) {
        const hidden = Math.max(0, runLength - ctx);
        if (hidden > 0) {
          for (let k = i; k < i + hidden; k++) visible.delete(ops[k]!);
          foldBefore.set(ops[i + hidden]!, hidden);
        }
      } else if (isTrailing) {
        const shown = Math.min(ctx, runLength);
        const hidden = runLength - shown;
        if (hidden > 0) {
          for (let k = i + shown; k < j; k++) visible.delete(ops[k]!);
          trailingFold = hidden;
        }
      } else if (runLength > ctx * 2) {
        const hiddenStart = i + ctx;
        const hiddenEnd = j - ctx;
        for (let k = hiddenStart; k < hiddenEnd; k++) visible.delete(ops[k]!);
        foldBefore.set(ops[hiddenStart]!, hiddenEnd - hiddenStart);
      }
      i = j;
    }
    return { visible, foldBefore, trailingFold };
  }

  private foldMarker(count: number): TemplateResult {
    const text = this.localize('diffViewHiddenLines', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(count),
      pluralCount: count,
    });
    return html`<div part="line" data-type="fold">${text}</div>`;
  }

  // -- anchor / search / highlights -----------------------------------------------------------

  /** Force-reveals the equal-run `op` belongs to (a no-op once it is already forced), then waits
   *  for that to render before the caller looks up the corresponding DOM line. */
  private async revealOp(op: LyraDiffOp): Promise<void> {
    if (!this.forcedVisibleOps.has(op)) {
      const next = new Set(this.forcedVisibleOps);
      next.add(op);
      this.forcedVisibleOps = next;
    }
    await this.updateComplete;
  }

  private lineElementForOpIndex(index: number): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-op-index="${index}"]`);
  }

  private async scrollOpIndexIntoView(index: number): Promise<boolean> {
    const op = this.diffOps[index];
    if (!op) return false;
    await this.revealOp(op);
    const target = this.lineElementForOpIndex(index);
    if (!target) return false;
    target.scrollIntoView({
      behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'auto' : 'smooth',
      block: 'nearest',
    });
    return true;
  }

  /** Resolves a `line-range` anchor by scrolling the line at its 0-based `start` op index into
   *  view, first expanding any `contextLines` fold currently hiding it. `end` is not consulted
   *  here -- it only widens what a covering `highlights` entry paints; the scroll target is
   *  always `start`. */
  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'line-range') return false;
    const index = anchor.start;
    if (!Number.isInteger(index) || index < 0 || index >= this.diffOps.length) return false;
    return this.scrollOpIndexIntoView(index);
  }

  /** Host-supplied `highlights` resolved against `this.diffOps`, keyed by the covered op. A
   *  `line-range` entry paints every op in its (clamped) `[start, end]` span, first-array-order
   *  highlight winning any overlap; `owners` records the first (lowest-index) op each highlight
   *  wins, the one that renders the focusable `[part="line-highlight-action"]` button; `order`
   *  positions each resolved highlight (0-based) for that button's accessible name, and `total`
   *  is the resolved-set size, mirroring `<lr-xml-viewer>`'s `highlightActionLabel()` numbering. */
  private resolvedHighlightOps(): {
    perOp: Map<LyraDiffOp, LyraHighlight>;
    owners: Map<LyraHighlight, LyraDiffOp>;
    order: Map<LyraHighlight, number>;
    total: number;
  } {
    const perOp = new Map<LyraDiffOp, LyraHighlight>();
    const owners = new Map<LyraHighlight, LyraDiffOp>();
    const order = new Map<LyraHighlight, number>();
    const ops = this.diffOps;
    if (ops.length === 0) return { perOp, owners, order, total: 0 };
    const seen = new Set<string>();
    for (const highlight of prioritizedHighlightCandidates(this.highlights, this.activeHighlightId)) {
      if (order.size >= MAX_PAINTED_HIGHLIGHTS) break;
      if (seen.has(highlight.id)) continue;
      seen.add(highlight.id);
      if (highlight.anchor.kind !== 'line-range') continue;
      const start = Math.max(0, Math.min(highlight.anchor.start, ops.length - 1));
      const end = Math.max(start, Math.min(highlight.anchor.end ?? highlight.anchor.start, ops.length - 1));
      let resolvedAny = false;
      for (let index = start; index <= end; index++) {
        const op = ops[index]!;
        resolvedAny = true;
        if (perOp.has(op)) continue;
        perOp.set(op, highlight);
        if (!owners.has(highlight)) owners.set(highlight, op);
      }
      if (resolvedAny) order.set(highlight, order.size);
    }
    return { perOp, owners, order, total: order.size };
  }

  /** The localized accessible name/label of one highlight's action button -- its own `label` when
   *  the host supplied one, otherwise its position in the resolved set. Mirrors `<lr-xml-viewer>`. */
  private highlightActionLabel(highlight: LyraHighlight, index: number, total: number): string {
    if (highlight.label) return this.localize('highlightWithLabel', undefined, { label: highlight.label });
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return this.localize('highlightOfTotal', undefined, {
      index: numberFormat.format(index + 1),
      total: numberFormat.format(total),
    });
  }

  private activateHighlight(highlight: LyraHighlight): void {
    this.emit('lr-highlight-activate', { highlightId: highlight.id });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      matchCountExact: this.searchMatchCountExact,
      activeIndex: this.searchActiveIndex,
    });
    announceSearchResult(
      (key, fallback, values) => this.localize(key, fallback, values),
      this.searchAnnouncer,
      this.effectiveLocale,
      this.searchMatches.length,
      this.searchActiveIndex,
    );
  }

  private recomputeSearchMatches(): void {
    this.lastSearchLocale = this.effectiveLocale;
    const boundedQuery = boundedViewerSearchQuery(this.searchQuery, this.effectiveLocale);
    const needle = boundedQuery.needle;
    const matches: DiffSearchMatch[] = [];
    let matchCountExact = boundedQuery.accepted;
    if (boundedQuery.accepted && needle) {
      const budget = new ViewerSearchWorkBudget();
      for (let index = 0; index < this.diffOps.length; index++) {
        if (budget.includes(this.diffOps[index]!.text, needle, this.effectiveLocale)) {
          if (matches.length === MAX_SEARCH_MATCHES) {
            matchCountExact = false;
            break;
          }
          matches.push({ opIndex: index });
        }
        if (!budget.complete) {
          matchCountExact = false;
          break;
        }
      }
    }
    this.searchMatches = matches;
    this.searchMatchCountExact = matchCountExact;
  }

  /** Resolves the retained match count -- one match per rendered line (diff op) whose text
   *  contains a locale-aware case-insensitive substring of `query`, ordered by that line's
   *  `line-range` op index; an empty/whitespace query behaves like `clearSearch()` and resolves
   *  `0`. Inspect `lr-search-change.matchCountExact` to distinguish an exact total from a lower
   *  bound once a resource ceiling is reached. */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.recomputeSearchMatches();
    this.searchActiveIndex = this.searchMatches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    const active = this.searchMatches[this.searchActiveIndex];
    if (active) await this.scrollOpIndexIntoView(active.opIndex);
    return this.searchMatches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `true` once the
   *  active match moved, `false` when there are no matches -- the shape the shared
   *  `LyraTextViewerTarget` search contract declares. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    await this.scrollOpIndexIntoView(this.searchMatches[this.searchActiveIndex]!.opIndex);
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `true` once the
   *  active match moved, `false` when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex = (this.searchActiveIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.emitSearchChange();
    await this.scrollOpIndexIntoView(this.searchMatches[this.searchActiveIndex]!.opIndex);
    return true;
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.emitSearchChange();
  }

  private get unifiedText(): string {
    return this.diffOps
      .map((op) => `${op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' '} ${op.text}`)
      .join('\n');
  }

  private isCurrentCopy(generation: number, owner: Window): boolean {
    return (
      this.isConnected &&
      this.copyable &&
      !this.diffTooLarge &&
      generation === this.copyGeneration &&
      this.ownerDocument.defaultView === owner
    );
  }

  private showCopyStatus(status: Exclude<CopyStatus, 'rest'>, generation: number): void {
    const owner = this.ownerDocument.defaultView;
    if (!owner || !this.isCurrentCopy(generation, owner)) return;
    this.copyStatus = status;
    this.copyAnnouncementSink?.announce(status === 'success' ? this.localize('copied') : this.localize('copyFailed'));
    this.cancelCopyTimer();
    let handle = 0;
    handle = owner.setTimeout(() => {
      const timer = this.copyTimer;
      if (
        timer?.owner !== owner ||
        timer.handle !== handle ||
        timer.generation !== generation ||
        !this.isCurrentCopy(generation, owner)
      )
        return;
      this.copyTimer = undefined;
      this.copyStatus = 'rest';
    }, COPY_CONFIRM_MS);
    this.copyTimer = { owner, handle, generation };
  }

  private async copy(): Promise<void> {
    if (!this.copyable || this.diffTooLarge) return;
    const generation = ++this.copyGeneration;
    this.cancelCopyTimer();
    this.copyStatus = 'rest';
    const text = this.unifiedText;
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    if (!owner) return;
    const outcome = await writeClipboardText(owner, text);
    if (!this.isCurrentCopy(generation, owner)) return;
    if (!outcome.ok) {
      this.showCopyStatus('error', generation);
      this.emit('lr-error');
      this.emit('lr-copy-error', outcome);
      return;
    }
    this.showCopyStatus('success', generation);
    this.emit('lr-copy', outcome);
  }

  private onCopyClick = (): void => {
    void this.copy();
  };

  /** Per-render O(1) lookups so each `renderDiffLine()` call doesn't re-scan `highlights`/
   *  `searchMatches`. */
  private lineRenderContext(): {
    perOp: Map<LyraDiffOp, LyraHighlight>;
    owners: Map<LyraHighlight, LyraDiffOp>;
    order: Map<LyraHighlight, number>;
    total: number;
    matchedOpIndexes: Set<number>;
    activeMatchOpIndex: number;
  } {
    const { perOp, owners, order, total } = this.resolvedHighlightOps();
    return {
      perOp,
      owners,
      order,
      total,
      matchedOpIndexes: new Set(this.searchMatches.map((match) => match.opIndex)),
      activeMatchOpIndex: this.searchMatches[this.searchActiveIndex]?.opIndex ?? -1,
    };
  }

  private renderDiffLine(
    op: LyraDiffOp,
    marker: string,
    content: ReturnType<typeof unsafeHTML> | string,
    context: ReturnType<LyraDiffView['lineRenderContext']>,
  ): TemplateResult {
    const index = this.opIndexMap.get(op);
    const isMatch = index !== undefined && context.matchedOpIndexes.has(index);
    const isActiveMatch = index !== undefined && index === context.activeMatchOpIndex;
    const highlight = context.perOp.get(op);
    const owner = highlight && context.owners.get(highlight) === op ? highlight : undefined;
    const ownerLabel = owner
      ? this.highlightActionLabel(owner, context.order.get(owner) ?? 0, context.total)
      : '';
    return html`<div
      part="line"
      data-type=${op.type}
      data-op-index=${index ?? nothing}
      ?data-match=${isMatch}
      ?data-active-match=${isActiveMatch}
      data-highlight=${highlight ? highlight.tone ?? 'accent' : nothing}
      ?data-active-highlight=${!!highlight && highlight.id === this.activeHighlightId}
    >${marker} ${content}${owner
      ? html`<button
          part="line-highlight-action"
          type="button"
          data-highlight-id=${owner.id}
          aria-label=${ownerLabel}
          @click=${(event: Event) => {
            event.stopPropagation();
            this.activateHighlight(owner);
          }}
        >${owner.label || ownerLabel}</button>`
      : nothing}</div>`;
  }

  // Tracks each op's index within the *original* per-source-line `oldText`/`newText` arrays --
  // `computeLineDiff` consumes one old line for every `remove`/`equal` op and one new line for
  // every `add`/`equal` op (an `equal` op advances both sides in lockstep), so both counters must
  // independently advance on `equal`. (A same-shaped but subtly wrong version of this that only
  // advances `newCounter` on `add` -- treating `equal` as belonging solely to the old side -- was
  // caught and fixed here: it silently misindexes `highlightedNewLines` for every `add` op that
  // follows an `equal` one, e.g. old=['a','b'] new=['a','x','b'] would highlight `x` using new
  // line 0's ('a') tokens instead of new line 1's.)
  private renderUnified(): TemplateResult {
    const { visible, foldBefore, trailingFold } = this.computeFolds();
    const context = this.lineRenderContext();
    let oldCounter = 0;
    let newCounter = 0;
    const rows: TemplateResult[] = [];
    for (const op of this.diffOps) {
      const fold = foldBefore.get(op);
      if (fold !== undefined) rows.push(this.foldMarker(fold));
      if (visible.has(op)) {
        const marker = op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' ';
        const lines = op.type === 'add' ? this.highlightedNewLines : this.highlightedOldLines;
        const index = op.type === 'add' ? newCounter : oldCounter;
        const highlighted = lines?.[index];
        rows.push(
          this.renderDiffLine(op, marker, highlighted !== undefined ? unsafeHTML(highlighted) : op.text, context),
        );
      }
      if (op.type !== 'add') oldCounter++;
      if (op.type !== 'remove') newCounter++;
    }
    if (trailingFold > 0) rows.push(this.foldMarker(trailingFold));
    return html`<pre>${rows}</pre>`;
  }

  private renderSplit(): TemplateResult {
    const { visible, foldBefore, trailingFold } = this.computeFolds();
    const context = this.lineRenderContext();
    const splitRows = pairOpsForSplit(this.diffOps);
    let oldCounter = 0;
    let newCounter = 0;
    const leftCells: TemplateResult[] = [];
    const rightCells: TemplateResult[] = [];
    for (const row of splitRows) {
      // An `equal` row's `left`/`right` are the exact same `LyraDiffOp` reference (see
      // `pairOpsForSplit()`), so folding either side is equivalent -- checked once via `row.left`.
      const foldOp =
        row.left && row.left.type === 'equal' ? row.left : row.right && row.right.type === 'equal' ? row.right : null;
      const fold = foldOp ? foldBefore.get(foldOp) : undefined;
      if (fold !== undefined) {
        leftCells.push(this.foldMarker(fold));
        rightCells.push(this.foldMarker(fold));
      }
      const rowHidden = foldOp !== null && !visible.has(foldOp);
      if (!rowHidden) {
        leftCells.push(this.renderSplitCell(row.left, row.left ? oldCounter : -1, this.highlightedOldLines, context));
        rightCells.push(this.renderSplitCell(row.right, row.right ? newCounter : -1, this.highlightedNewLines, context));
      }
      if (row.left) oldCounter++;
      if (row.right) newCounter++;
    }
    if (trailingFold > 0) {
      leftCells.push(this.foldMarker(trailingFold));
      rightCells.push(this.foldMarker(trailingFold));
    }
    return html`
      <div class="split-grid">
        <div part="side" data-side="old" role="region" aria-label=${this.localize('diffViewOldLabel')}>
          ${leftCells}
        </div>
        <div part="side" data-side="new" role="region" aria-label=${this.localize('diffViewNewLabel')}>
          ${rightCells}
        </div>
      </div>
    `;
  }

  private renderSplitCell(
    op: LyraDiffSplitRow['left'],
    lineIndex: number,
    highlightedLines: string[] | null,
    context: ReturnType<LyraDiffView['lineRenderContext']>,
  ): TemplateResult {
    if (!op) return html`<div part="line" data-type="empty"></div>`;
    const marker = op.type === 'add' ? '+' : op.type === 'remove' ? '-' : ' ';
    const highlighted = lineIndex >= 0 ? highlightedLines?.[lineIndex] : undefined;
    return this.renderDiffLine(op, marker, highlighted !== undefined ? unsafeHTML(highlighted) : op.text, context);
  }

  override render(): TemplateResult {
    const sanitizedMaxHeight = sanitizeCssLength(this.maxHeight);
    const maxHeightStyle = sanitizedMaxHeight
      ? styleMap({ '--lr-diff-view-max-height': sanitizedMaxHeight })
      : nothing;
    if (this.diffTooLarge) {
      return html`<div part="base" style=${maxHeightStyle}>
        <div part="limit">${this.localize('diffViewTooLarge')}</div>
      </div>
      ${this.renderAnchorLiveRegion()}`;
    }
    return html`
      <div part="base" style=${maxHeightStyle}>
        ${this.copyable
          ? html`<button
              part="copy-button"
              type="button"
              aria-label=${this.copyStatus === 'success'
                ? this.localize('copied')
                : this.copyStatus === 'error'
                ? this.localize('copyFailed')
                : this.localize('copyDiff')}
              @click=${this.onCopyClick}
            >
              ${this.copyStatus === 'success'
                ? this.localize('copied')
                : this.copyStatus === 'error'
                ? this.localize('copyFailed')
                : this.localize('copy')}
            </button>`
          : nothing}
        ${this.layout === 'split' ? this.renderSplit() : this.renderUnified()}
      </div>
      ${this.renderAnchorLiveRegion()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-diff-view': LyraDiffView;
  }
}
