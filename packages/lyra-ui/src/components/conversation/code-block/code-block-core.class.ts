import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { snapshotLyraHighlights } from '../../../internal/highlight-collection.js';
import {
  ensureShikiLanguageLoaded,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  resolvedShikiLanguages,
  type ShikiLanguageSource,
} from './shiki-types.js';
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


export interface LyraCodeBlockCoreEventMap extends LyraCodeBlockBaseEventMap {}
/**
 * `<lr-code-block-core>` — a build-lean variant of `<lr-code-block>` for
 * a consumer whose `languages` map already covers every language it will
 * ever render. It only ever calls `loadShikiHighlighterCore()` (from the peer-neutral Shiki
 * capability leaf) with `languages`' already-resolved entries — never `loadShikiHighlighter()`, the
 * default ~200-language dynamic-import table loader `<lr-code-block>` calls. This component's own
 * module never textually contains a call to (or import of) `loadShikiHighlighter` at all, so a
 * consumer importing `@aceshooting/lyra-ui/components/lr-code-block-core.js` instead of
 * `@aceshooting/lyra-ui/components/lr-code-block.js` gets a genuinely shiki-full-table-free build.
 *
 * A `languages` entry may also be a lazy loader (`() => import('@shikijs/langs/<name>')`) instead
 * of an already-resolved grammar — resolved and registered into the highlighter (via
 * `HighlighterCore.loadLanguage()`) the first time a fence actually requests that key, memoized per
 * key so it is never re-imported. See the `languages` property doc for the exact shape.
 *
 * A `language` value absent from `languages` always renders the plain
 * `<pre><code>` fallback — there is no default/full-table highlighter here
 * to fall back to, unlike `<lr-code-block>`'s dynamic-import path for an
 * unmapped language, and neither does a `languages` entry whose lazy loader rejects. That fallback
 * is the *default* rendering path, not a degraded one, same as `<lr-code-block>`'s own plain-text
 * fallback.
 *
 * Everything else — `code`/`language`/`filename`/`without-copy-button`/`collapsible`/
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
 * Direction: inside a right-to-left document the code body (`::part(body)`) is laid out
 * left-to-right and its scroll area opens at the start of the code, so under `dir="rtl"` its
 * vertical scrollbar sits on the physical right. The language badge is a left-to-right isolate and
 * the file name renders inside a first-strong `<bdi>` (its text content is unchanged); the header
 * row itself still follows the page direction. An outer `::part(body) { direction: rtl }` rule
 * restores right-to-left code. Bidi formatting characters inside code are rendered as authored.
 *
 * @customElement lr-code-block-core
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
 *   Shared with `lr-code-block` (this component reuses its stylesheet), `lr-code-editor`, and
 *   the markdown viewers' own `code-block` part, so every code surface agrees on a tab's width.
 * @cssprop [--lr-code-block-active-line-outline-color=var(--lr-color-brand)] - Outline color of
 *   the line marked active by `active-highlight-id`, leaving every other `--lr-color-brand`
 *   surface in the component alone.
 * @cssprop [--lr-code-block-highlighted-line-bg=var(--lr-color-warning-quiet)] - Background color
 *   of a line marked by `highlight-lines` or a `line-range` entry in `highlights`. Shared with
 *   `lr-code-block` (this component reuses its stylesheet), leaving every other
 *   `--lr-color-warning-quiet` surface alone.
 * @cssprop [--lr-code-block-language-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `language` badge in `[part="header"]`. Shared with `lr-code-block` (this component reuses its
 *   stylesheet).
 * @cssprop [--lr-code-block-language-color=var(--lr-color-brand)] - Text color of the `language`
 *   badge.
 * @cssprop [--lr-theme-scrollbar-width=auto] - Opt-in theme-level scrollbar width honored by
 *   `body`; unset, renders identically to before. Set on `:root` or any ancestor to retune every
 *   internal scroll container in the library at once. Shared with `lr-code-block` (this component
 *   reuses its stylesheet).
 * @cssprop [--lr-theme-scrollbar-gutter=auto] - Opt-in theme-level scrollbar gutter honored by
 *   `body`; see `--lr-theme-scrollbar-width`.
 * @status stable
 * @since 4.0.0
 */
export class LyraCodeBlockCore extends LyraCodeBlockBase {
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

  /** `languages` grammar objects are caller-owned data read only through Shiki's own APIs --
   *  bounded, detached, and frozen on assignment like every other public collection, so a later
   *  in-place mutation of a caller's grammar object can never silently change what this instance
   *  has already handed to `loadShikiHighlighterCore()`. */
  protected static override readonly ownedCollectionProperties = Object.freeze(['languages']);

  static override styles = [LyraElement.styles, styles];

  /** The raw source text. Removing the attribute renders an empty code block. */
  @property() override code = '';

  /** A shiki-recognized language id or alias (e.g. `"javascript"`,
   *  `"python"`, `"json"`). When unset, or when it isn't a key in
   *  `languages`, the code renders as plain unhighlighted text — this
   *  component has no default/full-table highlighter to fall back to. */
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

  /** Turns the (`line-numbers`-gated) gutter into a roving-tabindex group of buttons emitting
   *  `lr-line-activate`. Has no effect while `line-numbers` is unset. */
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
  // Declaration quote style is part of the published API snapshot normalizer.
  // prettier-ignore
  readonly anchorKinds: readonly LyraAnchor['kind'][] = ['line-range'];

  /** Grammar definitions this instance can highlight, e.g. `{ json: jsonGrammar }` (import from
   *  `shiki/langs/<name>.mjs`), or a lazy loader per key, e.g.
   *  `{ bash: () => import('@shikijs/langs/bash') }` -- called (at most once per key, memoized)
   *  the first time a fenced block actually requests that language, instead of requiring every
   *  grammar to already be imported before the map can be bound at all. This component has no
   *  default/full-table fallback highlighter -- a `language` absent from this map always renders
   *  the plain-text fallback, and so does a key whose loader rejects. Empty (the
   *  default) never highlights at all. Replacing the map starts a new loading generation; an
   *  older map that settles later cannot clear the current map's loading state or replace its
   *  highlighted output. For a TypeScript annotation, use `import type { ShikiLanguageSource } from
   *  '@aceshooting/lyra-ui/components/lr-code-block-core.js'`; this granular
   *  type-only import emits no registration side effect. */
  @property({ attribute: false }) languages: Readonly<Record<
    string,
    ShikiLanguageSource
  >> = {};

  // Identifies the active `languages` object across both the eager connected load and
  // syncHighlight()'s result path. A disconnect/reconnect or map replacement starts a new
  // generation, so an older cached promise can never mark the current map ready.
  private highlighterGeneration = 0;
  private activeLanguages?: Record<string, ShikiLanguageSource>;

  override connectedCallback(): void {
    super.connectedCallback();
    const languages = this.languages;
    const generation = this.activateLanguages(languages);
    if (Object.keys(languages).length === 0) return;
    void loadShikiHighlighterCore(resolvedShikiLanguages(languages)).then(() => {
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
    this.activeLanguages = undefined;
    this.highlighterGeneration += 1;
    this.shikiReady = false;
  }

  // The `languages` entry for the *current* `language`, if any -- shared by
  // `willUpdate()`/`updated()`/`render()`/`syncHighlight()` so they all agree
  // on whether this language is highlightable at all.
  protected override preSuppliedGrammar(): ShikiLanguageSource | undefined {
    return codeBlockPreSuppliedGrammar(this.languages, this.language ?? '');
  }

  protected override beforeHighlightUpdate(changed: PropertyValues): void {
    if (changed.has('languages')) this.activateLanguages(this.languages);
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

  /** Whether this render shows the loading skeleton instead of the code. Unlike `<lr-code-block>`,
   *  the only highlighter this variant ever waits on is the fine-grained one seeded from
   *  `languages` -- so a `language` absent from that map has nothing pending and never shows the
   *  skeleton. Read by both `updated()` and `render()` so the `aria-busy` host attribute can never
   *  disagree with what's on screen. */
  protected override showsSkeleton(): boolean {
    return codeBlockShowsSkeleton(
      this.shikiReady,
      this.language,
      !!this.preSuppliedGrammar()
    );
  }

  private activateLanguages(
    languages: Record<string, ShikiLanguageSource>
  ): number {
    if (this.activeLanguages === languages) return this.highlighterGeneration;
    this.activeLanguages = languages;
    this.highlighterGeneration += 1;
    this.highlightToken += 1;
    this.shikiReady = false;
    this.highlightedHtml = null;
    return this.highlighterGeneration;
  }

  protected override syncHighlight(): void {
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

    const source = languages?.[lang] ?? languages?.[this.language];
    if (source === undefined) {
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
    // loadShikiHighlighterCore() itself caches by its (resolved-languages,
    // engine) identity, so a call here that lands on the same map
    // connectedCallback() already kicked off just resolves the shared
    // cached promise instead of loading twice.
    this.highlightedHtml = null;
    void loadShikiHighlighterCore(resolvedShikiLanguages(languages)).then(async (hl) => {
      if (token !== this.highlightToken) return; // superseded by a newer code/language/languages change
      if (
        generation !== this.highlighterGeneration ||
        languages !== this.languages
      )
        return;
      if (!hl) {
        if (!this.isConnected) return;
        this.shikiReady = true;
        this.highlightedHtml = null;
        return;
      }
      // `source` may still be an unresolved lazy loader here -- a no-op, already-resolved promise
      // when it is a plain grammar, since loadShikiHighlighterCore() already seeded that one into
      // `hl` above.
      const loaded = await ensureShikiLanguageLoaded(hl, lang, source);
      if (token !== this.highlightToken) return; // superseded while the loader/loadLanguage() awaited
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
      this.highlightedHtml = loaded ? this.tokenize(hl, lang) : null;
    });
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'lr-code-block-core': LyraCodeBlockCore;
  }
}
