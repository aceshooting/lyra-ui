import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { DocumentRef } from '../../../ai/types.js';
import type { LyraAnchor, LyraHighlight } from '../document-viewer/anchors.js';
import type { LyraDocumentPreview } from '../document-preview/document-preview.class.js';
import type { ShikiLanguageInput } from '../../conversation/code-block/code-loader.js';
import '../document-preview/document-preview.js';
import '../../utility/diff-view/diff-view.js';
import { styles } from './document-compare.styles.js';

export interface LyraDocumentCompareEventMap {
  /** Bubbles unchanged from the internal `<lr-diff-view>` while `view="diff"`. `detail: { text }` — the full unified-diff text. */
  'lr-copy': CustomEvent<{ text: string }>;
  /** Bubbles unchanged from whichever pane's `<lr-document-preview>` it originated in, while `view="side-by-side"`. `detail: { id }`. Activating a highlight that shares its `id` with a highlight on the *other* version also scrolls that pane to the matching highlight -- see the class doc's "Synchronized anchors" section. */
  'lr-highlight-activate': CustomEvent<{ id: string }>;
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
 *   that shares its `id` with a highlight in the *other* version's `highlights` scrolls that pane
 *   to its own matching highlight via `<lr-document-preview>`'s own `scrollToAnchor()`. The
 *   `lr-highlight-activate` event itself still bubbles through unchanged (`detail: { id }`, no
 *   side discriminator) so an existing listener contract stays exactly what
 *   `<lr-document-preview>` already documents.
 * - A shared `anchor` property (same declarative shape as `<lr-document-viewer>`'s own `anchor`)
 *   drives both panes to the same target at once via their own `scrollToAnchor()`.
 *
 * @customElement lr-document-compare
 * @event lr-copy - See `LyraDocumentCompareEventMap`.
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
 * @cssprop [--lr-document-compare-pane-max-height=24rem] - Maximum block size of a side-by-side pane before it scrolls internally.
 */
export class LyraDocumentCompare extends LyraElement<LyraDocumentCompareEventMap> {
  static styles = [LyraElement.styles, styles];

  /** `'diff'` (the default) renders one inline `<lr-diff-view>`; `'side-by-side'` renders two
   *  independently-scrollable `<lr-document-preview>` panes -- see the class doc's "Synchronized
   *  anchors" section for how the two panes are kept in sync. */
  @property({ reflect: true }) view: 'diff' | 'side-by-side' = 'diff';

  /** The "before" version. */
  @property({ attribute: false }) oldVersion?: DocumentCompareVersion;

  /** The "after" version. */
  @property({ attribute: false }) newVersion?: DocumentCompareVersion;

  /** Forwarded to the internal `<lr-diff-view>`'s own `layout` property while `view="diff"`. */
  @property({ attribute: 'diff-layout', reflect: true }) diffLayout: 'unified' | 'split' = 'unified';

  /** Forwarded to the internal `<lr-diff-view>`'s own `copyable` property while `view="diff"`. */
  @property({ type: Boolean }) copyable = false;

  /** Forwarded to the internal `<lr-diff-view>`'s own `language` property while `view="diff"`. */
  @property() language = '';

  /** Forwarded to the internal `<lr-diff-view>`'s own `languages` property while `view="diff"`. */
  @property({ attribute: false }) languages?: Record<string, ShikiLanguageInput>;

  /** Whether scrolling one `view="side-by-side"` pane proportionally scrolls the other. See the
   *  class doc's "Synchronized anchors" section. */
  @property({ type: Boolean, attribute: 'sync-scroll' }) syncScroll = true;

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

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    const anchor = this.anchor;
    if (anchor == null) return;
    const shouldJump = changed.has('anchor') || (changed.has('view') && this.view === 'side-by-side');
    if (!shouldJump) return;
    void this.previewOldEl?.scrollToAnchor(anchor);
    void this.previewNewEl?.scrollToAnchor(anchor);
  }

  private onPaneScroll = (source: 'old' | 'new'): (() => void) => {
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
      requestAnimationFrame(() => {
        this.suppressSync = false;
      });
    };
  };

  /** Handles a pane's own `lr-highlight-activate` (not re-emitted -- the event bubbles through
   *  unchanged, see the class doc). When the other version has a highlight sharing this `id`,
   *  scrolls that pane to it too. */
  private onHighlightActivate(side: 'old' | 'new', event: CustomEvent<{ id: string }>): void {
    const { id } = event.detail;
    const otherVersion = side === 'old' ? this.newVersion : this.oldVersion;
    if (!otherVersion?.highlights?.some((h) => h.id === id)) return;
    const otherPreview = side === 'old' ? this.previewNewEl : this.previewOldEl;
    void otherPreview?.scrollToAnchor(id);
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

  private renderVersionPane(version: DocumentCompareVersion | undefined, side: 'old' | 'new'): TemplateResult {
    if (!version) return html`<p part="pane-empty">${this.localize('documentCompareNoVersion')}</p>`;
    return html`
      <lr-document-preview
        filename=${version.name ?? ''}
        mime-type=${version.mimeType ?? ''}
        src=${version.uri ?? ''}
        .highlights=${version.highlights ?? []}
        @lr-highlight-activate=${(e: CustomEvent<{ id: string }>) => this.onHighlightActivate(side, e)}
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

  render(): TemplateResult {
    return html`
      <div part="base" role="group" aria-label=${this.getAttribute('aria-label') || this.localize('documentCompareLabel')}>
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
