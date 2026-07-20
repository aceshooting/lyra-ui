import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import '../../layout/virtual-list/virtual-list.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './chunk-inspector.styles.js';

/** A local, non-exported structural copy of the `lr-document-viewer` `LyraAnchor` discriminated
 *  union, declared here (rather than imported) so this component has no build-time coupling to the
 *  viewer stack. Structurally identical to the real thing, so `chunk.anchor` interops with a
 *  `document-viewer.anchor` assignment with no mapping needed. */
type LyraChunkAnchor =
  | { kind: 'page'; page: number }
  | { kind: 'text-quote'; quote: string; prefix?: string; suffix?: string; page?: number }
  | { kind: 'fragment'; id: string }
  | { kind: 'line-range'; start: number; end?: number }
  | { kind: 'cell-range'; sheet?: string; range: string }
  | { kind: 'cfi'; cfi: string }
  | { kind: 'time-range'; start: number; end?: number }
  | { kind: 'region'; page?: number; rect: { x: number; y: number; width: number; height: number } }
  | { kind: 'node-path'; path: (string | number)[] };

export interface LyraChunk {
  id: string;
  text: string;
  /** 0-1 relevance. */
  score: number;
  sourceId: string;
  /** e.g. filename; falls back to localized `untitledSource`. */
  title?: string;
  /** Rendered as-is via the existing `sourcePageSuffix` key. */
  page?: string | number;
  /** Carried through `lr-chunk-open` verbatim. */
  anchor?: LyraChunkAnchor;
}

export interface LyraChunkInspectorEventMap {
  'lr-chunk-open': CustomEvent<{ id: string; sourceId: string; anchor?: LyraChunkAnchor }>;
  'lr-expand': CustomEvent<{ id: string; expanded: boolean }>;
}

type Tier = 'high' | 'medium' | 'low';

/**
 * `<lr-chunk-inspector>` — a ranked retrieved-chunks list: relevance score bars with tier tones,
 * expandable chunk text, and the deep-link event that lands a chunk in `lr-document-viewer`.
 * Never fetches, ranks, or dedupes; never opens documents itself.
 *
 * @customElement lr-chunk-inspector
 * @event lr-chunk-open - A chunk's title/open button was activated -- the event a host routes
 * into `lr-document-viewer` (set `src` from `sourceId`, set `anchor`). `detail: { id, sourceId,
 * anchor? }`.
 * @event lr-expand - A chunk's text toggle was activated. `detail: { id, expanded }`.
 * @csspart base - The `role="group"` wrapper.
 * @csspart chunk - One chunk row (`role="listitem"`).
 * @csspart score - The visible percent-score text.
 * @csspart score-bar - The `aria-hidden` score bar track.
 * @csspart score-fill - The score bar's tone-mapped fill.
 * @csspart open-button - The chunk's title/open `<button>`.
 * @csspart title - The `<span>` inside `open-button` carrying the visible title text. Split from
 * `open-button` (rather than a dual part name on one element) because an exact-match
 * `[part="..."]` CSS attribute selector -- as used by this component's own tests -- cannot match
 * a multi-token `part` attribute value.
 * @csspart text - The chunk's text preview, line-clamped unless expanded. Omitted when `compact`.
 * @csspart toggle - The "Show more"/"Show less" button. Omitted when `compact`.
 * @csspart empty - The empty-state message, shown when `chunks` is empty.
 * @cssprop [--lr-chunk-inspector-current-bg=var(--lr-color-brand-quiet)] - Background of the chunk
 *   matching `activeId`. **Contrast-sensitive:** paired with
 *   `--lr-chunk-inspector-current-color`, which has to keep a 4.5:1 ratio against it.
 * @cssprop [--lr-chunk-inspector-current-color=var(--lr-color-text)] - Text color of the current
 *   chunk's `[part="score"]` line. **Contrast-sensitive:** the quiet token it replaces only reaches
 *   ~4.24:1 against the current background, so override this together with
 *   `--lr-chunk-inspector-current-bg`, never alone.
 */
export class LyraChunkInspector extends LyraElement<LyraChunkInspectorEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) chunks: LyraChunk[] = [];
  @property({ attribute: false }) thresholds: { high: number; medium: number } = { high: 0.75, medium: 0.5 };
  @property() sort: 'score' | 'none' = 'score';
  /** Marks the chunk currently open in the viewer. */
  @property({ attribute: 'active-id' }) activeId = '';
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 50;
  /** Compact rows render title + score bar + open button only. */
  @property({ type: Boolean, reflect: true }) compact = false;
  @property() label = '';

  @state() private expandedIds = new Set<string>();

  /** `virtualizeAt`, normalized to a finite non-negative integer (falling back to the property's
   *  own default of `50`) -- a raw `NaN` (e.g. an invalid `virtualize-at` attribute) would
   *  otherwise make `sorted.length > virtualizeAt` always false, silently disabling
   *  virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 50);
  }

  private sortedChunks(): LyraChunk[] {
    return this.sort === 'score' ? [...this.chunks].sort((a, b) => b.score - a.score) : this.chunks;
  }

  private tier(score: number): Tier {
    if (score >= this.thresholds.high) return 'high';
    if (score >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  private tierTone(tier: Tier): 'success' | 'warning' | 'danger' {
    return tier === 'high' ? 'success' : tier === 'medium' ? 'warning' : 'danger';
  }

  private tierLabel(tier: Tier): string {
    return this.localize(tier === 'high' ? 'scoreTierHigh' : tier === 'medium' ? 'scoreTierMedium' : 'scoreTierLow');
  }

  private toggleExpand(id: string): void {
    const next = new Set(this.expandedIds);
    const expanded = !next.has(id);
    if (expanded) next.add(id);
    else next.delete(id);
    this.expandedIds = next;
    this.emit('lr-expand', { id, expanded });
  }

  private renderChunk = (item: unknown): TemplateResult => {
    const chunk = item as LyraChunk;
    const tier = this.tier(chunk.score);
    const tone = this.tierTone(tier);
    const percent = Math.round(chunk.score * 100);
    const titleText = chunk.title || this.localize('untitledSource');
    const titleWithPage =
      chunk.page == null || chunk.page === '' ? titleText : this.localize('sourcePageSuffix', undefined, { base: titleText, page: chunk.page });
    const expanded = this.expandedIds.has(chunk.id);
    return html`
      <div part="chunk" role="listitem" aria-current=${this.activeId === chunk.id ? 'true' : nothing}>
        <div part="score">
          <span>${this.localize('chunkScore', undefined, { percent })}</span>
          <span part="score-bar" aria-hidden="true"
            ><span part="score-fill" data-tone=${tone} style=${styleMap({ inlineSize: `${percent}%` })}></span
          ></span>
        </div>
        <button
          part="open-button"
          type="button"
          aria-label=${`${titleWithPage}, ${this.tierLabel(tier)}`}
          @click=${() => this.emit('lr-chunk-open', { id: chunk.id, sourceId: chunk.sourceId, ...(chunk.anchor ? { anchor: chunk.anchor } : {}) })}
        >
          <span part="title">${titleWithPage}</span>
        </button>
        ${!this.compact
          ? html`<p part="text" ?data-clamped=${!expanded}>${chunk.text}</p>
              <button part="toggle" type="button" aria-expanded=${expanded ? 'true' : 'false'} @click=${() => this.toggleExpand(chunk.id)}>
                ${this.localize(expanded ? 'showLess' : 'showMore')}
              </button>`
          : nothing}
      </div>
    `;
  };

  render(): TemplateResult {
    const sorted = this.sortedChunks();
    const label = this.label || this.localize('chunkInspectorLabel');
    if (sorted.length === 0) {
      // `heading` is passed as slotted light-DOM content (rather than the `heading` attribute
      // most other components use) so `[part="empty"]`'s `.textContent` -- a plain DOM accessor,
      // which never pierces `lr-empty`'s own shadow root -- actually includes the message; see
      // this component's notes for why the attribute-only form other components use wouldn't.
      return html`<div part="base">
        <lr-empty part="empty"><span slot="heading">${this.localize('chunkInspectorEmpty')}</span></lr-empty>
      </div>`;
    }
    return html`
      <div part="base" role="group" aria-label=${label}>
        ${sorted.length > this.effectiveVirtualizeAt
          ? html`<lr-virtual-list
              .items=${sorted}
              .renderItem=${this.renderChunk}
              .keyFunction=${(item: unknown) => (item as LyraChunk).id}
              .activeId=${this.activeId || ''}
            ></lr-virtual-list>`
          : html`<div role="list">${sorted.map((c) => this.renderChunk(c))}</div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chunk-inspector': LyraChunkInspector;
  }
}
