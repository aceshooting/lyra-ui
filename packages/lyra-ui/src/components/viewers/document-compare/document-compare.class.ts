import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { DocumentRef } from '../../../ai/types.js';
import type {
  HighlightActivateDetail,
  LyraAnchor,
  LyraHighlight,
} from '../document-viewer/anchors.js';
import type { LyraDocumentPreview } from '../document-preview/document-preview.class.js';
import type { ShikiLanguageInput } from '../../conversation/code-block/code-loader.js';
import type { LyraDiffViewLayout } from '../../utility/diff-view/diff-view.class.js';
import {
  literalSetConverter,
  trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import type {
  LyraClipboardWriteFailure,
  LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import { styles } from './document-compare.styles.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_documentCompareLabel, LYRA_DEFAULT_documentCompareNewVersion, LYRA_DEFAULT_documentCompareNoVersion, LYRA_DEFAULT_documentCompareOldVersion, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Which pane a comparison side identifies -- `'old'` is the "before" version, `'new'` is the
 *  "after" version. */
export type DocumentComparePaneSide = 'old' | 'new';

/** `'diff'` (the default) renders one inline `<lr-diff-view>`; `'side-by-side'` renders two
 *  independently-scrollable `<lr-document-preview>` panes. */
export type LyraDocumentCompareView = 'diff' | 'side-by-side';

const DOCUMENT_COMPARE_VIEW = literalSetConverter<LyraDocumentCompareView>(
  ['diff', 'side-by-side'],
  'diff',
);
const DOCUMENT_COMPARE_DIFF_LAYOUT = literalSetConverter<LyraDiffViewLayout>(
  ['unified', 'split'],
  'unified',
);

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once the property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead (mirrors `lr-checkpoint`'s identical
 *  converter). */

export interface LyraDocumentCompareEventMap {
  /** Bubbles unchanged from the internal `<lr-diff-view>` after the clipboard write fulfills. */
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  /** Bubbles unchanged from the internal `<lr-diff-view>` when clipboard writing fails. */
  'lr-error': CustomEvent<null>;
  /** Detailed clipboard failure bubbled unchanged from the internal `<lr-diff-view>`. */
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  /** Bubbles unchanged from whichever pane's `<lr-document-preview>` it originated in, while `view="side-by-side"`. `detail: { highlightId }`. Activating a highlight that shares its `id` with a highlight on the *other* version also scrolls that pane to the matching highlight -- see the class doc's "Synchronized anchors" section. */
  'lr-highlight-activate': CustomEvent<HighlightActivateDetail>;
  /** Bubbles unchanged from whichever pane's `<lr-document-preview>` it originated in. `detail: { src, filename }`. */
  'lr-download': CustomEvent<{ src: string; filename: string }>;
  /** Bubbles unchanged from whichever pane's `<lr-document-preview>` it originated in (a failed `text/*` fetch). `detail: { error }`. */
  'lr-render-error': CustomEvent<{ error: unknown }>;
}

/**
 * One document version to compare. Extends the shared `DocumentRef` (`id`/`name`/`mimeType`/
 * `uri`/`version`) with the two fields a comparison needs that a bare document reference doesn't
 * carry: the literal `text` an `<lr-diff-view>` diffs directly, and this version's own
 * `<lr-document-preview>` region `highlights` (see "Synchronized anchors" below). `uri` (from
 * `DocumentRef`) maps onto `<lr-document-preview>`'s own `src` property, and `mimeType` maps onto
 * its `mimeType` property field-for-field; `name` maps onto its differently-named `filename`
 * property (per `DocumentRef`'s own doc comment, `name` matches `<lr-attachment-chip>`'s property
 * name, not `<lr-document-preview>`'s).
 */
export interface DocumentCompareVersion extends DocumentRef {
  /** Literal text content for this version -- diffed directly by `view="diff"` (no fetch involved), unlike `<lr-document-preview>`'s own text-format dispatch which fetches `uri`. */
  text?: string;
  /** Region highlights rendered over this version's own `<lr-document-preview>` pane (image format only -- see that component's own scope). An id shared between `oldVersion.highlights` and `newVersion.highlights` is what "synchronized anchors" resolves against. */
  highlights?: LyraHighlight[];
}

function versionSourceIdentity(version: DocumentCompareVersion | undefined): string {
  if (!version) return '';
  return JSON.stringify([
    version.id ?? '',
    version.uri ?? '',
    version.version ?? '',
    version.mimeType ?? '',
    version.name ?? '',
  ]);
}

/**
 * `<lr-document-compare>` — side-by-side or inline comparison of two document versions, composed
 * entirely from two existing primitives rather than reimplementing either: `<lr-diff-view>` is the
 * real two-string line diff (`view="diff"`, the default), and `<lr-document-preview>` renders each
 * version's own actual content in `view="side-by-side"`.
 *
 * **Synchronized anchors.** `<lr-diff-view>`'s own `layout="split"` needs no scroll-sync of its
 * own -- both columns already live inside one shared scrolling container, so they move together
 * for free. `view="side-by-side"` is different: it renders two *independent*
 * `<lr-document-preview>` panes, each with its own scrollbar, so nothing keeps them aligned on its
 * own. This component adds exactly two minimal, purpose-built coordination mechanisms for that
 * case (mirroring `<lr-compare-panel>`'s own proven proportional-scroll algorithm rather than
 * inventing a new one):
 * - **Continuous scroll sync** (`syncScroll`, default `true`): scrolling either pane
 *   proportionally scrolls the other to the same *fraction* of its own scrollable range, not the
 *   same pixel offset -- the two versions can have very different lengths. A re-entrancy guard
 *   stops the mirrored write from bouncing back.
 * - **Highlight-anchor sync**: activating a region highlight in one pane (`lr-highlight-activate`)
 *   that shares its normalized `id` with a highlight in the *other* preview scrolls that pane to
 *   its own matching highlight via `<lr-document-preview>`'s own `scrollToAnchor()`. Both lookup
 *   and activation use the preview's trimmed, nonempty, first-wins highlight projection. The
 *   `lr-highlight-activate` event itself still bubbles through unchanged (`detail: {
 *   highlightId }`, no
 *   side discriminator) so an existing listener contract stays exactly what
 *   `<lr-document-preview>` already documents.
 * - A shared `anchor` property (same declarative shape as `<lr-document-viewer>`'s own `anchor`)
 *   drives both panes to the same target at once via their own `scrollToAnchor()`.
 * - Replacing a pane with a different source identity resets that pane to the top (both panes while
 *   `syncScroll` is true). Re-rendering the same identity preserves reading position, and an active
 *   shared `anchor` always wins over the reset.
 *
 * A nonempty host `aria-label` makes the host the sole named semantic owner. An explicitly empty
 * host label remains on the shadow group, and absence restores its localized comparison label.
 *
 * @customElement lr-document-compare
 * @event lr-copy - See `LyraDocumentCompareEventMap`.
 * @event lr-error - See `LyraDocumentCompareEventMap`.
 * @event lr-copy-error - See `LyraDocumentCompareEventMap`.
 * @event lr-highlight-activate - See `LyraDocumentCompareEventMap`.
 * @event lr-download - See `LyraDocumentCompareEventMap`.
 * @event lr-render-error - See `LyraDocumentCompareEventMap`.
 * @csspart base - The root wrapper.
 * @csspart diff - The internal `<lr-diff-view>`, rendered while `view="diff"`.
 * @csspart panes - The row (or, under 640px, column) wrapping both panes, rendered while `view="side-by-side"`.
 * @csspart pane-old - The first (old/before) version's labeled, independently-scrollable pane.
 * @csspart pane-new - The second (new/after) version's labeled, independently-scrollable pane.
 * @csspart pane-header - A pane's visible label.
 * @csspart pane-empty - The placeholder shown in a pane whose version is unset.
 * @cssprop [--lr-document-compare-pane-max-height=var(--lr-size-24rem)] - Maximum block size of a side-by-side pane before it scrolls internally.
 * @status stable
 * @since 4.1.0
 */
export class LyraDocumentCompare extends LyraElement<LyraDocumentCompareEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    documentCompareLabel: LYRA_DEFAULT_documentCompareLabel,
    documentCompareNewVersion: LYRA_DEFAULT_documentCompareNewVersion,
    documentCompareNoVersion: LYRA_DEFAULT_documentCompareNoVersion,
    documentCompareOldVersion: LYRA_DEFAULT_documentCompareOldVersion,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** `'diff'` (the default) renders one inline `<lr-diff-view>`; `'side-by-side'` renders two
   *  independently-scrollable `<lr-document-preview>` panes -- see the class doc's "Synchronized
   *  anchors" section for how the two panes are kept in sync. Unsupported values normalize to
   *  reflected `diff`. */
  private _view: LyraDocumentCompareView = 'diff';

  @property({ reflect: true, converter: DOCUMENT_COMPARE_VIEW })
  get view(): LyraDocumentCompareView {
    return this._view;
  }
  set view(next: LyraDocumentCompareView) {
    const normalized = DOCUMENT_COMPARE_VIEW.normalizeReflected(this, 'view', next);
    const old = this._view;
    if (old === normalized) return;
    this._view = normalized;
    this.requestUpdate('view', old);
  }

  /** The "before" version. */
  @property({ attribute: false }) oldVersion?: DocumentCompareVersion;

  /** The "after" version. */
  @property({ attribute: false }) newVersion?: DocumentCompareVersion;

  /** Forwarded to the internal `<lr-diff-view>`'s own `layout` property while `view="diff"`;
   *  unsupported values normalize to reflected `unified`. */
  private _diffLayout: LyraDiffViewLayout = 'unified';

  @property({ attribute: 'diff-layout', reflect: true, converter: DOCUMENT_COMPARE_DIFF_LAYOUT })
  get diffLayout(): LyraDiffViewLayout {
    return this._diffLayout;
  }
  set diffLayout(next: LyraDiffViewLayout) {
    const normalized = DOCUMENT_COMPARE_DIFF_LAYOUT.normalizeReflected(this, 'diff-layout', next);
    const old = this._diffLayout;
    if (old === normalized) return;
    this._diffLayout = normalized;
    this.requestUpdate('diffLayout', old);
  }

  /** Forwarded to the internal `<lr-diff-view>`'s own `copyable` property while `view="diff"`. */
  @property({ type: Boolean }) copyable = false;

  /** Forwarded to the internal `<lr-diff-view>`'s own `language` property while `view="diff"`. */
  @property() language = '';

  /** Forwarded to the internal `<lr-diff-view>`'s own `languages` property while `view="diff"`. */
  @property({ attribute: false }) languages?: Record<string, ShikiLanguageInput>;

  /** Whether scrolling one `view="side-by-side"` pane proportionally scrolls the other. See the
   *  class doc's "Synchronized anchors" section. */
  @property({ attribute: 'sync-scroll', converter: trueDefaultBooleanConverter }) syncScroll = true;

  /** A shared scroll-to-anchor target forwarded to both `view="side-by-side"` panes'
   *  `scrollToAnchor()`. `hasChanged: () => true` so re-assigning the same value (e.g. re-clicking
   *  the same source reference) still re-fires, mirroring `<lr-document-viewer>`'s identical
   *  property. */
  @property({ attribute: false, hasChanged: () => true }) anchor: LyraAnchor | string | null = null;

  @query('[part="pane-old"]') private paneOldEl?: HTMLElement;
  @query('[part="pane-new"]') private paneNewEl?: HTMLElement;
  @query('[part="pane-old"] lr-document-preview') private previewOldEl?: LyraDocumentPreview;
  @query('[part="pane-new"] lr-document-preview') private previewNewEl?: LyraDocumentPreview;

  // Guards the fraction-based mirrored scrollTop write below from re-triggering its own 'scroll'
  // listener on the pane it just wrote to -- same guard `<lr-compare-panel>`'s own
  // onPaneScroll() uses.
  private suppressSync = false;
  private syncReleaseFrame?: number;
  private syncReleaseView?: Window;

  override disconnectedCallback(): void {
    this.cancelSyncRelease();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // A pending callback belongs to the browsing context that scheduled it. Adoption can happen
    // between the mirrored scroll write and that callback, so cancel through the retained owner
    // instead of leaving the suppression guard stranded in the old document.
    this.cancelSyncRelease();
  }

  private cancelSyncRelease(): void {
    if (this.syncReleaseFrame !== undefined) {
      this.syncReleaseView?.cancelAnimationFrame(this.syncReleaseFrame);
    }
    this.syncReleaseFrame = undefined;
    this.syncReleaseView = undefined;
    this.suppressSync = false;
  }

  private scheduleSyncRelease(): void {
    const view = this.ownerDocument.defaultView;
    if (!view) {
      this.suppressSync = false;
      return;
    }
    const frame = view.requestAnimationFrame(() => {
      if (this.syncReleaseView !== view || this.syncReleaseFrame !== frame) return;
      this.syncReleaseFrame = undefined;
      this.syncReleaseView = undefined;
      this.suppressSync = false;
    });
    this.syncReleaseView = view;
    this.syncReleaseFrame = frame;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const anchor = this.anchor;
    const sourceChanged = (property: 'oldVersion' | 'newVersion'): boolean =>
      changed.has(property)
      && versionSourceIdentity(changed.get(property) as DocumentCompareVersion | undefined)
        !== versionSourceIdentity(this[property]);
    const oldSourceChanged = sourceChanged('oldVersion');
    const newSourceChanged = sourceChanged('newVersion');

    if (anchor != null) {
      const shouldJump =
        changed.has('anchor') ||
        (this.view === 'side-by-side' &&
          (changed.has('view') || changed.has('oldVersion') || changed.has('newVersion')));
      if (shouldJump) {
        void this.previewOldEl?.scrollToAnchor(anchor);
        void this.previewNewEl?.scrollToAnchor(anchor);
      }
      return;
    }
    if (this.view !== 'side-by-side' || (!oldSourceChanged && !newSourceChanged)) return;
    this.cancelSyncRelease();
    if (this.syncScroll || oldSourceChanged) {
      if (this.paneOldEl) this.paneOldEl.scrollTop = 0;
    }
    if (this.syncScroll || newSourceChanged) {
      if (this.paneNewEl) this.paneNewEl.scrollTop = 0;
    }
  }

  private onPaneScroll = (source: DocumentComparePaneSide): (() => void) => {
    return () => {
      if (!this.syncScroll || this.suppressSync) return;
      const from = source === 'old' ? this.paneOldEl : this.paneNewEl;
      const to = source === 'old' ? this.paneNewEl : this.paneOldEl;
      if (!from || !to) return;
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0) return;
      const fraction = from.scrollTop / fromMax;
      this.suppressSync = true;
      to.scrollTop = fraction * toMax;
      this.scheduleSyncRelease();
    };
  };

  /** Handles a pane's own `lr-highlight-activate` (not re-emitted -- the event bubbles through
   *  unchanged, see the class doc). When the other version has a highlight sharing this ID,
   *  scrolls that pane to it too. */
  private onHighlightActivate(side: DocumentComparePaneSide, event: CustomEvent<HighlightActivateDetail>): void {
    const { highlightId } = event.detail;
    const otherPreview = side === 'old' ? this.previewNewEl : this.previewOldEl;
    if (!otherPreview?.highlights.some((highlight) => highlight.id === highlightId)) return;
    void otherPreview?.scrollToAnchor(highlightId);
  }

  private versionLabel(version: DocumentCompareVersion | undefined, fallbackKey: 'documentCompareOldVersion' | 'documentCompareNewVersion'): string {
    return version?.name || version?.version || this.localize(fallbackKey);
  }

  private renderDiff(): TemplateResult {
    return html`
      <lr-diff-view
        part="diff"
        .oldText=${this.oldVersion?.text ?? ''}
        .newText=${this.newVersion?.text ?? ''}
        layout=${this.diffLayout}
        ?copyable=${this.copyable}
        language=${this.language}
        .languages=${this.languages}
      ></lr-diff-view>
    `;
  }

  private renderVersionPane(version: DocumentCompareVersion | undefined, side: DocumentComparePaneSide): TemplateResult {
    if (!version) return html`<p part="pane-empty">${this.localize('documentCompareNoVersion')}</p>`;
    return html`
      <lr-document-preview
        filename=${version.name ?? ''}
        mime-type=${version.mimeType ?? ''}
        src=${version.uri ?? ''}
        .highlights=${version.highlights ?? []}
        @lr-highlight-activate=${(e: CustomEvent<HighlightActivateDetail>) =>
          this.onHighlightActivate(side, e)}
      ></lr-document-preview>
    `;
  }

  private renderSideBySide(): TemplateResult {
    const oldLabel = this.versionLabel(this.oldVersion, 'documentCompareOldVersion');
    const newLabel = this.versionLabel(this.newVersion, 'documentCompareNewVersion');
    return html`
      <div part="panes">
        <div part="pane-old" role="region" aria-label=${oldLabel} tabindex="0" @scroll=${this.onPaneScroll('old')}>
          <div part="pane-header">${oldLabel}</div>
          ${this.renderVersionPane(this.oldVersion, 'old')}
        </div>
        <div part="pane-new" role="region" aria-label=${newLabel} tabindex="0" @scroll=${this.onPaneScroll('new')}>
          <div part="pane-header">${newLabel}</div>
          ${this.renderVersionPane(this.newVersion, 'new')}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    return html`
      <div part="base" role=${viewerSemanticRole(this, 'group') ?? nothing} aria-label=${viewerSemanticLabel(this, this.localize('documentCompareLabel')) ?? nothing}>
        ${this.view === 'side-by-side' ? this.renderSideBySide() : this.renderDiff()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-document-compare': LyraDocumentCompare;
  }
}
