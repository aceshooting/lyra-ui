import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { snapshotLyraHighlights } from '../../../internal/highlight-collection.js';
import {
  loadShikiHighlighter,
  loadShikiLanguage,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  shikiHasLoadedLanguage,
  type ShikiHighlighter,
  type ShikiLanguageInput,
} from './code-loader.js';
import { styles } from './code-block.styles.js';
import type { LyraCodeBlockCopyAppearance } from './code-block-shared.js';
import { LyraCodeBlockBase, type LyraCodeBlockBaseEventMap } from './code-block-base.class.js';
import { codeBlockPreSuppliedGrammar, codeBlockShowsSkeleton } from './code-block-shared.js';
export type { LyraCodeBlockToggleDetail } from './code-block-shared.js';
import type {
  LyraAnchor,
  LyraHighlight,
} from '../../viewers/document-viewer/anchors.js';
import '../../overlays/skeleton/skeleton.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_codeRegion, LYRA_DEFAULT_codeRegionWithLanguage, LYRA_DEFAULT_collapseCode, LYRA_DEFAULT_copied, LYRA_DEFAULT_copiedToClipboard, LYRA_DEFAULT_copy, LYRA_DEFAULT_copyCode, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_expandCode } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraCodeBlockEventMap extends LyraCodeBlockBaseEventMap {}
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
 * `scrollToAnchor()` resolves a `line-range` anchor. `activatable-lines` is a separate, purely
 * local affordance that turns the (`line-numbers`-gated) gutter into a keyboard-navigable,
 * clickable roving-tabindex group emitting `lr-line-activate` — it doesn't require `highlights` to
 * be set. If controlled `code` shrinks while a line owns focus, focus follows the clamped
 * surviving line through both plain and highlighted DOM replacement; an explicit move to another
 * control during the update is never overridden.
 *
 * Direction: inside a right-to-left document the code body (`::part(body)`) is laid out
 * left-to-right and its scroll area opens at the start of the code, so under `dir="rtl"` its
 * vertical scrollbar sits on the physical right. The language badge is a left-to-right isolate and
 * the file name renders inside a first-strong `<bdi>` (its text content is unchanged); the header
 * row itself still follows the page direction. An outer `::part(body) { direction: rtl }` rule
 * restores right-to-left code. Bidi formatting characters inside code are rendered as authored.
 *
 * @customElement lr-code-block
 * @event lr-copy - The raw `code` was written to the clipboard. Frozen detail:
 *   `{ ok: true, text }`.
 * @event lr-error - Clipboard writing failed; generic no-detail notification.
 * @event lr-copy-error - Clipboard writing failed. Frozen detail:
 *   `{ ok: false, text, reason, error }`, where `reason` is
 *   `'unsupported' | 'denied' | 'failed'`.
 * @event lr-toggle-request - Cancelable request emitted before collapse state changes.
 *   `detail: { expanded }` carries the proposed next state.
 * @event lr-toggle - The collapse/expand header button was activated.
 *   `detail: { expanded }` carries the resulting state, matching
 *   `<lr-thinking-panel>`'s own `lr-toggle` event name and shape convention.
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
 * @csspart copy-button - The copy-to-clipboard control, unless `without-copy-button`. A composed
 *   `<lr-icon-button>` as of 16.0.0: it still owns the accessible name, the activation and the part
 *   names, while its background, radius, hover/press mixes, focus ring and hit-area floor now come
 *   from `--lr-icon-button-*`. Also carries `copy-button-text` or `copy-button-icon` for the active
 *   `copyAppearance`, since a state cannot be selected with `::part(copy-button)[attr]`.
 * @csspart copy-button-text - The copy control while `copyAppearance` is `'text'`.
 * @csspart copy-button-icon - The copy control while `copyAppearance` is `'icon'`.
 * @csspart copy-button-control - The copy control's own native `<button>`, forwarded because the
 *   painted surface sits one shadow boundary deeper than `copy-button`.
 * @csspart header-actions - The wrapper around the `header-actions` slot, at the trailing end of
 *   the header row.
 * @slot header-actions - Extra controls for the header row, rendered after the copy control. Their
 *   presence alone is enough to render the header.
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
 * @cssprop [--lr-code-block-language-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `language` badge in `[part="header"]`.
 * @cssprop [--lr-code-block-language-color=var(--lr-color-brand)] - Text color of the `language`
 *   badge.
 *   Same default as `--lr-code-editor-tab-size`, so the editable and read-only code surfaces
 *   agree; `lr-markdown`/`lr-markdown-core` declare the same token for their own
 *   `code-block` part (they are sibling elements, so they cannot inherit this one). Read as a
 *   token and never written inline, so a host override survives shiki's own inline `style` on
 *   the highlighted `pre`. The default is a `var()` fallback at the point of use rather than a
 *   `:host` declaration, so it inherits: set it on the element, a container, or `:root` and it
 *   reaches every code surface below. All Markdown and standalone code blocks preserve lines and scroll horizontally.
 * @cssprop [--lr-code-block-active-line-outline-color=var(--lr-color-brand)] - Outline color of
 *   the line marked active by `active-highlight-id`. Retints just that outline, leaving every
 *   other `--lr-color-brand` surface in the component (header pill, hover states, focus ring)
 *   alone. Inherits, so it can also be set on an ancestor or at the theme level.
 * @cssprop [--lr-code-block-highlighted-line-bg=var(--lr-color-warning-quiet)] - Background color
 *   of a line marked by `highlight-lines` or a `line-range` entry in `highlights`, in both the
 *   light and dark-theme (shiki) rendering paths. Retints just that background, leaving every
 *   other `--lr-color-warning-quiet` surface alone. Inherits, so it can also be set on an
 *   ancestor or at the theme level.
 * @cssprop [--lr-theme-scrollbar-width=auto] - Opt-in theme-level scrollbar width honored by
 *   `body`; unset, renders identically to before. Set on `:root` or any ancestor to retune every
 *   internal scroll container in the library at once. Shared with `lr-code-block-core` (which
 *   reuses this stylesheet).
 * @cssprop [--lr-theme-scrollbar-gutter=auto] - Opt-in theme-level scrollbar gutter honored by
 *   `body`; see `--lr-theme-scrollbar-width`.
 * @status stable
 * @since 4.0.0
 */
export class LyraCodeBlock extends LyraCodeBlockBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
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
  protected static override collectionSupport = collectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-text-select',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** The raw source text. Removing the attribute renders an empty code block. */
  @property() override code = '';

  /** A shiki-recognized language id or alias (e.g. `"javascript"`,
   *  `"python"`, `"json"`). When unset, or when shiki doesn't recognize it,
   *  the code renders as plain unhighlighted text regardless of whether
   *  shiki itself is available. */
  @property() override language = '';

  /** Shown in the header above the code, when set. */
  @property() override filename = '';

  /** Accessible-name override for the internal focusable code region. Maps
   *  to the host's `aria-label` attribute and wins over `filename` and
   *  `language`-derived defaults. */
  @property({ attribute: 'aria-label' }) override accessibleLabel: string | null = null;

  /** Whether the code region can be collapsed via a header toggle. */
  @property({ type: Boolean, reflect: true }) override collapsible = false;

  /** Whether the code region is currently hidden. Only has a visible effect
   *  while `collapsible` is also true. */
  @property({ type: Boolean, reflect: true }) override collapsed = false;

  /** Hides the copy-to-clipboard button in the header. */
  @property({ type: Boolean, attribute: 'without-copy-button', reflect: true })
  override withoutCopyButton = false;

  /** How the header's copy control presents itself. `'text'` (the default) is the labelled button
   *  this component has always rendered -- unset, nothing about the header changes. `'icon'` swaps
   *  the visible label for a compact glyph and promotes the same localized Copy/Copied/failure
   *  string to the control's accessible name, for a dense header that already carries a filename,
   *  a language chip and slotted `header-actions`. */
  @property({ attribute: 'copy-appearance', reflect: true })
  override copyAppearance: LyraCodeBlockCopyAppearance = 'text';

  /** A CSS length (e.g. `"20rem"`); once set, the code scrolls internally
   *  past this height instead of growing the page. */
  @property({ attribute: 'max-height' }) override maxHeight = '';

  /** Whether to display one-based line numbers beside the code. Highlighted gutters
   *  follow live locale and line-label string changes. */
  @property({ type: Boolean, attribute: 'line-numbers', reflect: true })
  override lineNumbers = false;

  /** Comma-separated 1-based inclusive line ranges (e.g. `"3-5,7"`) to visually emphasize.
   *  Removing the attribute clears these ranges. Declarative sugar over `highlights` — merges with, and renders identically to, any
   *  `line-range` entries in `highlights`. */
  @property({ attribute: 'highlight-lines' }) override highlightLines = '';

  /** Makes the (`line-numbers`-gated) gutter a roving group of activation buttons. */
  @property({ type: Boolean, attribute: 'activatable-lines' })
  override activatableLines = false;

  private _highlights: readonly LyraHighlight[] = snapshotLyraHighlights([]);
  /** Host-supplied highlights to paint over the code. Only `line-range` anchors are meaningful
   *  here — every other `LyraAnchor` kind, and a highlight with a missing, malformed, or
   *  non-discriminated anchor, is ignored (`snapshotLyraHighlights`).
   * @default [] */
  @property({ attribute: false })
  override get highlights(): readonly LyraHighlight[] { return this._highlights; }
  override set highlights(value: readonly LyraHighlight[]) {
    const previous = this._highlights;
    this._highlights = snapshotLyraHighlights(value);
    this.requestUpdate('highlights', previous);
  }

  /** The `highlights` entry, if any, currently treated as active (`data-active` on its lines). */
  @property({ attribute: 'active-highlight-id' }) override activeHighlightId:
    | string
    | null = null;

  /** Anchor kinds this component resolves via `scrollToAnchor()`. */
  readonly anchorKinds: readonly LyraAnchor['kind'][] = ['line-range'];

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
   *  back to that default dynamic-import path unchanged. For a TypeScript
   *  annotation, use `import type { ShikiLanguageInput } from
   *  '@aceshooting/lyra-ui/components/lr-code-block.js'`;
   *  this granular type-only import emits no registration side effect. */
  @property({ attribute: false }) languages?: Readonly<Record<
    string,
    ShikiLanguageInput
  >>;
  private highlighter?: ShikiHighlighter | null;

  private defaultHighlighterLoading = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.ensureDefaultHighlighter();
    if (this.preSuppliedGrammar() || this.highlighter) this.syncHighlight();
  }

  private ensureDefaultHighlighter(): void {
    if (
      !this.isConnected ||
      this.highlighter !== undefined ||
      this.defaultHighlighterLoading
    )
      return;
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

  // The `languages` entry for the *current* `language`, if any -- shared by
  // `willUpdate()`/`updated()`/`render()`/`syncHighlight()` so they all agree
  // on whether this render is taking the fine-grained `languages` path or
  // the default `loadShikiHighlighter()` one.
  protected override preSuppliedGrammar(): ShikiLanguageInput | undefined {
    return codeBlockPreSuppliedGrammar(this.languages, this.language ?? '');
  }

  protected override showsSkeleton(): boolean {
    return codeBlockShowsSkeleton(this.shikiReady, this.language, !this.preSuppliedGrammar());
  }

  /** Resolves a `line-range` anchor (or a `highlights` id string resolving to one) by scrolling
   *  its start line into view within `[part="body"]`. Resolves `false` when the anchor isn't a
   *  `line-range`, the id isn't found, or the start line is out of bounds. */
  override async scrollToAnchor(target: LyraAnchor | string): Promise<boolean> {
    return super.scrollToAnchor(target);
  }

  /** Recomputes Shiki palette selection after an imperative CSSOM theme change. */
  override refreshTheme(): void {
    super.refreshTheme();
  }

  // Mutating `highlightedHtml` here (rather than in `updated()`) absorbs the
  // synchronous case -- language already loaded, see `syncHighlight()` --
  // into this same update cycle instead of scheduling a second one, Lit's
  // documented pattern for deriving one reactive property from a change to
  // others (same approach <lr-markdown>'s `willUpdate` takes).
  protected override syncHighlight(): void {
    // Bumped unconditionally -- on *every* call, not just the async branch
    // below -- so that a call landing on the synchronous already-loaded
    // branch still invalidates any earlier in-flight load from a previous
    // call. Without this, a load kicked off by an older call can resolve
    // after a newer call has already rendered correct synchronous output,
    // and overwrite it with stale tokenization.
    const token = ++this.highlightToken;
    const lang = normalizeShikiLanguage(this.language ?? '');
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
        // Lit's first update cycle (which is what calls syncHighlight() via willUpdate() for an
        // element that had `language`/`languages` set before it ever connected) still runs even if
        // the element disconnects in the same synchronous tick as connectedCallback(), before that
        // first update's microtask fires -- so this needs its own isConnected guard alongside
        // connectedCallback()'s, not just the staleness check above, to avoid mutating @state on a
        // dead instance. Same guard <lr-code-block-core> carries on its own fine-grained load.
        if (!this.isConnected) return;
        this.highlightedHtml = hl ? this.tokenize(hl, lang) : null;
      });
      return;
    }

    const hl = this.highlighter;
    if (!hl) {
      this.highlightedHtml = null;
      return;
    }
    if (shikiHasLoadedLanguage(hl, lang)) {
      this.highlightedHtml = this.tokenize(hl, lang);
      return;
    }
    // Grammar not loaded yet -- show the plain-text fallback in the
    // meantime rather than leaving a *previous* code/language value's stale
    // highlighted markup on screen while this one loads.
    this.highlightedHtml = null;
    void loadShikiLanguage(hl, lang).then((ok) => {
      if (token !== this.highlightToken) return; // superseded by a newer code/language change
      if (!this.isConnected) return; // see the fine-grained branch above -- same first-update race
      this.highlightedHtml = ok ? this.tokenize(hl, lang) : null;
    });
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'lr-code-block': LyraCodeBlock;
  }
}
