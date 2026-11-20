import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { isRovingTargetAvailable, resolveListMove } from '../../../internal/list-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { loadLazyChildren } from '../../../internal/lazy-children.js';
import { normalizeSize, type LyraSize } from '../../../internal/variants.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import {
  finiteCount,
  finiteNumber,
  finiteRange,
} from '../../../internal/numbers.js';
import {
  getListFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import '../../layout/virtual-list/virtual-list.class.js';
import type { LyraVirtualList, LyraVirtualListEventMap } from '../../layout/virtual-list/virtual-list.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './chunk-inspector.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
import { DEFAULT_SCORE_THRESHOLDS, resolveScoreTiers, type LyraScoreThresholds } from '../../../internal/score-tiers.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chunkInspectorEmpty, LYRA_DEFAULT_chunkInspectorLabel, LYRA_DEFAULT_chunkInspectorOpenOrdinal, LYRA_DEFAULT_chunkScore, LYRA_DEFAULT_retrievalShowLessWithContext, LYRA_DEFAULT_retrievalShowMoreWithContext, LYRA_DEFAULT_scoreTierHigh, LYRA_DEFAULT_scoreTierLow, LYRA_DEFAULT_scoreTierMedium, LYRA_DEFAULT_showMore, LYRA_DEFAULT_sourcePageSuffix, LYRA_DEFAULT_untitledSource } from '../../../internal/default-strings/retrieval.generated.js';
import { LYRA_DEFAULT_showLess } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraScoreThresholds } from '../../../internal/score-tiers.js';
/** A local, non-exported structural copy of the `lr-document-viewer` `LyraAnchor` discriminated
 *  union, declared here (rather than imported) so this component has no build-time coupling to the
 *  viewer stack. Structurally identical to the real thing, so `chunk.anchor` interops with a
 *  `document-viewer.anchor` assignment with no mapping needed. */
type LyraChunkAnchor =
  | { kind: 'page'; page: number }
  | {
      kind: 'text-quote';
      quote: string;
      prefix?: string;
      suffix?: string;
      page?: number;
    }
  | { kind: 'fragment'; id: string }
  | { kind: 'line-range'; start: number; end?: number }
  | { kind: 'cell-range'; sheet?: string; range: string }
  | { kind: 'cfi'; cfi: string }
  | { kind: 'time-range'; start: number; end?: number }
  | {
      kind: 'region';
      page?: number;
      rect: { x: number; y: number; width: number; height: number };
    }
  | { kind: 'node-path'; path: readonly (string | number)[] };

export interface LyraChunk {
  id: string;
  text: string;
  /** 0-1 relevance. */
  score: number;
  sourceId: string;
  /** e.g. filename; falls back to localized `untitledSource`. */
  title?: string;
  /** Finite numeric values are locale-formatted for display; string locators stay verbatim. */
  page?: string | number;
  /** Carried through `lr-chunk-open` verbatim. */
  anchor?: LyraChunkAnchor;
}

export interface LyraChunkInspectorEventMap {
  'lr-chunk-open': CustomEvent<LyraEventDetailSnapshot<{
    chunkId: string;
    sourceId: string;
    anchor?: LyraChunkAnchor;
  }>>;
  'lr-toggle': CustomEvent<{ expanded: boolean; itemId: string }>;
}

type Tier = 'high' | 'medium' | 'low';
type ChunkAction = 'open-button' | 'toggle';

/** How `<lr-chunk-inspector>` orders the chunks it was given. */
export type ChunkInspectorSort = 'score' | 'none';

/** Whether a `size` sits on the dense tier uses for dense rendering. */
function isDenseSize(size: LyraSize): boolean {
  const step = normalizeSize(size);
  return step === 's' || step === 'xs' || step === '2xs';
}

/**
 * `<lr-chunk-inspector>` — a ranked retrieved-chunks list: relevance score bars with tier tones,
 * expandable chunk text, and the deep-link event that lands a chunk in `lr-document-viewer`.
 * Never fetches or ranks and never opens documents itself. Blank chunk identities and later
 * duplicates are omitted first-wins before sorting, rendering, state, or events.
 *
 * Standalone lists with multiple rows share a Tab stop across row actions. Up/Down and Home/End
 * move between rows; inline arrows switch between Open and Show more/less.
 *
 * Every row-level part is reachable through `::part()` in both rendering paths: above
 * `virtualize-at` a row lives in the internal `<lr-virtual-list>`'s shadow root, and its parts are
 * re-exported from there under the same names. Row *state* is exposed as an additional part name
 * (`chunk-current`, `score-current`, `score-fill-<tone>`, `text-clamped`) rather than as an
 * attribute on the part, because Shadow Parts forbids an attribute selector after `::part()` --
 * `::part(chunk)[aria-current='true']` is invalid CSS. The equivalent attributes are still present
 * on the elements. A state part is a second token in the same `part` attribute, so a `[part~="..."]`
 * (not `[part="..."]`) selector is the one that matches inside a tree.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-chunk-inspector
 * @event lr-chunk-open - A chunk's title/open button was activated -- the event a host routes
 * into `lr-document-viewer` (set `src` from `sourceId`, set `anchor`). `detail: { chunkId,
 * sourceId, anchor? }`.
 * @event lr-toggle - A chunk's text toggle was activated, expanding or collapsing it.
 *   `detail: { expanded, itemId }`; `expandedChunkIds` already reflects it.
 * @csspart base - The result wrapper. It owns `role="group"` and the fallback name unless a
 *   non-empty host `aria-label` makes the host the sole overall owner.
 * @csspart chunk - One chunk row. Carries `role="listitem"` only in the non-virtualized path;
 * while virtualized the surrounding `<lr-virtual-list>` row supplies that role instead.
 * @csspart chunk-current - Additional part on the `chunk` row matching `activeChunkId`.
 * @csspart score - The visible percent-score text.
 * @csspart score-current - Additional part on the current row's `score` line.
 * @csspart score-bar - The `aria-hidden` score bar track.
 * @csspart score-fill - The score bar's tone-mapped fill.
 * @csspart score-fill-success - Additional part on a `score-fill` in the high-score tier.
 * @csspart score-fill-warning - Additional part on a `score-fill` in the medium-score tier.
 * @csspart score-fill-danger - Additional part on a `score-fill` in the low-score tier.
 * @csspart open-button - The chunk's title/open `<button>`.
 * @csspart title - The `<span>` inside `open-button` carrying the visible title text. Split from
 * `open-button` (rather than a dual part name on one element) because an exact-match
 * `[part="..."]` CSS attribute selector -- as used by this component's own tests -- cannot match
 * a multi-token `part` attribute value.
 * @csspart text - The chunk's text preview. Omitted while `size` is `s` or smaller.
 * @csspart text-clamped - Additional part on a `text` preview that is still collapsed
 * (line-clamped); dropped once that chunk is expanded.
 * @csspart toggle - The "Show more"/"Show less" button. Omitted while `size` is `s` or smaller.
 * @csspart empty - The empty-state message, shown when `chunks` is empty.
 * @cssprop [--lr-chunk-inspector-current-bg=var(--lr-color-brand-quiet)] - Background of the chunk
 *   matching `activeChunkId`. **Contrast-sensitive:** paired with
 *   `--lr-chunk-inspector-current-color`, which has to keep a 4.5:1 ratio against it.
 * @cssprop [--lr-chunk-inspector-current-color=var(--lr-color-text)] - Text color of the current
 *   chunk's `[part="score"]` line. **Contrast-sensitive:** the quiet token it replaces only reaches
 *   ~4.24:1 against the current background, so override this together with
 *   `--lr-chunk-inspector-current-bg`, never alone.
 * @status stable
 * @since 4.0.0
 */
export class LyraChunkInspector extends LyraElement<LyraChunkInspectorEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chunkInspectorEmpty: LYRA_DEFAULT_chunkInspectorEmpty,
    chunkInspectorLabel: LYRA_DEFAULT_chunkInspectorLabel,
    chunkInspectorOpenOrdinal: LYRA_DEFAULT_chunkInspectorOpenOrdinal,
    chunkScore: LYRA_DEFAULT_chunkScore,
    retrievalShowLessWithContext: LYRA_DEFAULT_retrievalShowLessWithContext,
    retrievalShowMoreWithContext: LYRA_DEFAULT_retrievalShowMoreWithContext,
    scoreTierHigh: LYRA_DEFAULT_scoreTierHigh,
    scoreTierLow: LYRA_DEFAULT_scoreTierLow,
    scoreTierMedium: LYRA_DEFAULT_scoreTierMedium,
    showLess: LYRA_DEFAULT_showLess,
    showMore: LYRA_DEFAULT_showMore,
    sourcePageSuffix: LYRA_DEFAULT_sourcePageSuffix,
    untitledSource: LYRA_DEFAULT_untitledSource,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'chunks',
    'expandedChunkIds',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-chunk-open',
  ]);

  /** Retrieved chunks to inspect. The input order is preserved when `sort="none"`. */
  @property({ attribute: false }) chunks: readonly LyraChunk[] = [];
  /** Score boundaries used to classify each chunk as high, medium, or low relevance. */
  @property({ attribute: false }) thresholds: LyraScoreThresholds = DEFAULT_SCORE_THRESHOLDS;
  /** Ordering applied before rendering the supplied chunks. */
  @property() sort: ChunkInspectorSort = 'score';
  /** Marks the chunk currently open in the viewer. */
  @property({ attribute: 'active-chunk-id' }) activeChunkId = '';
  /** Row count at which rendering switches to the internal virtual list. */
  @property({ type: Number, attribute: 'virtualize-at' }) virtualizeAt = 50;
  /**
   * Row density on the shared size scale. `s` (and the smaller `xs`/`2xs`) renders dense rows:
   * title, score bar and open button only, without the text preview and its toggle. `m` (the
   * default) and larger render the full rows.
   */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Ids of the chunks whose text is expanded. The inspector updates its own copy on toggle, then
   *  emits `lr-toggle`; reassign to control. */
  @property({ attribute: false }) expandedChunkIds: readonly string[] = [];
  /** Fallback name for the populated chunk group; omitting it falls back to the localized default
   *  and an explicit empty string clears it. A non-empty host `aria-label` makes the host the sole
   *  overall owner; an explicitly empty host label stays empty on the group. */
  @property() label?: string;
  /** Optional one-based position supplied by a containing result list. The standalone inspector
   * uses each chunk's position in its own sorted list when this is unset. Setting it marks the
   * inspector as one row of that list, so it renders without its own group, list or listitem
   * semantics. */
  @property({ attribute: false }) ordinalIndex?: number;
  /** Logical result count paired with `ordinalIndex`. */
  @property({ attribute: false }) ordinalTotal?: number;

  @state() private rovingChunk?: { id: string; action: ChunkAction };

  private pendingChunkFocus?: { chunks: readonly LyraChunk[]; index: number; action: ChunkAction; from: HTMLButtonElement };

  private virtualRange?: LyraVirtualListEventMap['lr-visible-range-change']['detail'];

  override disconnectedCallback(): void {
    this.pendingChunkFocus = undefined;
    this.virtualRange = undefined;
    super.disconnectedCallback();
  }

  /** Whether `size` selects the dense rows (`s` or smaller). */
  private get dense(): boolean {
    return isDenseSize(this.size);
  }

  /** `virtualizeAt`, normalized to a finite non-negative integer (falling back to the property's
   *  own default of `50`) -- a raw `NaN` (e.g. an invalid `virtualize-at` attribute) would
   *  otherwise make `sorted.length > virtualizeAt` always false, silently disabling
   *  virtualization instead of falling back to the default threshold. */
  private get effectiveVirtualizeAt(): number {
    return finiteCount(this.virtualizeAt, 50);
  }

  // Memoizes the sorted view for as long as neither input actually changed. `<lr-virtual-list>`
  // keys its own O(n) offset/identity rebuild and its memoized activeIndex on the *reference*
  // identity of the `items` array it is handed, so returning a freshly-allocated sort on every
  // render made every unrelated update (a new `activeChunkId`, `size`) rebuild the whole list.
  private sortedChunksCache?: {
    source: readonly LyraChunk[];
    sort: ChunkInspectorSort;
    result: readonly LyraChunk[];
  };
  private chunkOrdinalById = new Map<string, number>();

  private sortedChunks(): readonly LyraChunk[] {
    const cached = this.sortedChunksCache;
    if (cached && cached.source === this.chunks && cached.sort === this.sort)
      return cached.result;
    const canonical = firstByRetrievalIdentity(this.chunks, (chunk) => chunk.id);
    const result =
      this.sort === 'score'
        ? canonical.sort(
            (a, b) => this.safeScore(b.score) - this.safeScore(a.score)
          )
        : canonical;
    this.sortedChunksCache = { source: this.chunks, sort: this.sort, result };
    this.chunkOrdinalById = new Map(result.map((chunk, index) => [chunk.id, index]));
    return result;
  }

  // A stable bound field, not an inline arrow recreated per render: `<lr-virtual-list>` compares
  // `keyFunction` by reference too, and a new closure invalidates the same caches a new items array
  // would. Mirrors the sibling `renderVirtualChunk` field just below.
  private readonly chunkKey = (item: unknown): string => (item as LyraChunk).id;

  private safeScore(score: number): number {
    return finiteRange(score, 0, 0, 1);
  }

  private tier(score: number): Tier {
    const safeScore = this.safeScore(score);
    const { high, medium } = resolveScoreTiers(DEFAULT_SCORE_THRESHOLDS, this.thresholds);
    if (safeScore >= high) return 'high';
    if (safeScore >= medium) return 'medium';
    return 'low';
  }

  private tierTone(tier: Tier): 'success' | 'warning' | 'danger' {
    return tier === 'high'
      ? 'success'
      : tier === 'medium'
      ? 'warning'
      : 'danger';
  }

  private tierLabel(tier: Tier): string {
    return this.localize(
      tier === 'high'
        ? 'scoreTierHigh'
        : tier === 'medium'
        ? 'scoreTierMedium'
        : 'scoreTierLow'
    );
  }

  private toggleExpand(chunkId: string): void {
    const expanded = !this.expandedChunkIds.includes(chunkId);
    this.expandedChunkIds = expanded
      ? [...this.expandedChunkIds, chunkId]
      : this.expandedChunkIds.filter((id) => id !== chunkId);
    this.emit('lr-toggle', { itemId: chunkId, expanded });
  }

  private get rovesChunkActions(): boolean {
    return this.ordinalIndex === undefined && this.sortedChunks().length > 1;
  }

  private chunkTabIndex(index: number, action: ChunkAction): number | typeof nothing {
    if (!this.rovesChunkActions) return nothing;
    const current = this.rovingChunk;
    const currentIndex = current ? this.chunkOrdinalById.get(current.id) : undefined;
    const currentAction = this.dense || currentIndex === undefined ? 'open-button' : current!.action;
    return index === (currentIndex ?? 0) && action === currentAction ? 0 : -1;
  }

  private rememberChunkAction(id: string, action: ChunkAction): void {
    if (!this.rovesChunkActions || (this.rovingChunk?.id === id && this.rovingChunk.action === action)) return;
    this.rovingChunk = { id, action };
  }

  private onChunkActionKey(event: KeyboardEvent, index: number, action: ChunkAction): void {
    if (event.defaultPrevented || !this.rovesChunkActions) return;
    const chunks = this.sortedChunks();
    const row = resolveListMove(event, { count: chunks.length, current: index, orientation: 'vertical', wrap: false });
    const column = row === null && !this.dense && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ? resolveListMove(event, { count: 2, current: action === 'toggle' ? 1 : 0, orientation: 'horizontal', direction: this.effectiveDirection, wrap: false })
      : null;
    if (row === null && column === null) return;
    event.preventDefault();
    const nextIndex = row ?? index;
    const nextAction = column === null ? action : column === 0 ? 'open-button' : 'toggle';
    const list = this.renderRoot.querySelector<LyraVirtualList>(tag('virtual-list'));
    this.pendingChunkFocus = undefined;
    const from = event.currentTarget as HTMLButtonElement;
    const root = list?.shadowRoot ?? this.renderRoot;
    const target = this.chunkAction(root, nextIndex, nextAction);
    if (target && isRovingTargetAvailable(target, this)) target.focus({ preventScroll: Boolean(list) });
    if (!list) return;
    if (!target) this.pendingChunkFocus = { chunks, index: nextIndex, action: nextAction, from };
    list.scrollToIndex(nextIndex, { behavior: 'auto' });
  }

  private chunkAction(root: ParentNode, index: number, action: ChunkAction): HTMLButtonElement | null {
    return root.querySelector<HTMLButtonElement>(`[data-chunk-index="${index}"] [part="${action}"]`);
  }

  private onVirtualRange = (event: LyraVirtualListEventMap['lr-visible-range-change']): void => {
    event.stopPropagation();
    this.virtualRange = event.detail;
    const pending = this.pendingChunkFocus;
    if (pending) {
      const root = (event.currentTarget as LyraVirtualList).shadowRoot!;
      if (pending.chunks !== this.sortedChunks() || deepActiveElementIn(root) !== pending.from) {
        this.pendingChunkFocus = undefined;
      } else {
        const target = this.chunkAction(root, pending.index, pending.action);
        if (!target) return;
        this.pendingChunkFocus = undefined;
        if (isRovingTargetAvailable(target, this)) target.focus({ preventScroll: true });
      }
    }
    if (!deepActiveElementIn(this.shadowRoot)?.closest('[data-chunk-index]')) this.rebaseVirtualTabStop();
  };

  private rebaseVirtualTabStop(): void {
    const range = this.virtualRange;
    if (!range || !this.rovesChunkActions) return;
    const current = this.chunkOrdinalById.get(this.rovingChunk?.id ?? '') ?? 0;
    if (current >= range.start && current <= range.end) return;
    const row = this.sortedChunks()[range.start];
    if (row) this.rememberChunkAction(row.id, 'open-button');
  }

  // Row state is mirrored into a second part-name token (`chunk-current`, `score-fill-<tone>`,
  // `text-clamped`) alongside the attribute that already carries it. Whenever this row is rendered
  // through `<lr-virtual-list>` it lives in *that* component's shadow root, reachable only via
  // `::part()`, and Shadow Parts forbids an attribute selector after `::part()` -- so the state has
  // to be expressible as a part name or it cannot be styled at all in that path. The attributes
  // stay put: they carry the semantics (`aria-current`) and remain the selector a consumer uses
  // inside its own tree.
  private chunkTemplate(
    chunk: LyraChunk,
    index: number,
    virtualized: boolean
  ): TemplateResult {
    const tier = this.tier(chunk.score);
    const tone = this.tierTone(tier);
    const percent = Math.round(this.safeScore(chunk.score) * 100);
    const formattedPercent = getNumberFormat(this.effectiveLocale).format(
      percent
    );
    const titleText = chunk.title || this.localize('untitledSource');
    const formattedPage =
      typeof chunk.page === 'number' && Number.isFinite(chunk.page)
        ? getNumberFormat(this.effectiveLocale).format(
            finiteNumber(chunk.page, 0)
          )
        : chunk.page;
    const titleWithPage =
      formattedPage == null || formattedPage === ''
        ? titleText
        : this.localize('sourcePageSuffix', undefined, {
            base: titleText,
            page: formattedPage,
          });
    const ordinalIndex = this.ordinalIndex === undefined
      ? index + 1
      : Math.max(1, finiteCount(this.ordinalIndex, 1));
    const ordinalTotal = this.ordinalTotal === undefined
      ? this.sortedChunks().length
      : Math.max(ordinalIndex, finiteCount(this.ordinalTotal, ordinalIndex));
    const expanded = this.isChunkExpanded(chunk.id);
    const current = this.activeChunkId === chunk.id;
    return html`
      <div
        part=${current ? 'chunk chunk-current' : 'chunk'}
        data-chunk-index=${index}
        role=${virtualized ? nothing : 'listitem'}
        aria-current=${current ? 'true' : 'false'}
      >
        <div part=${current ? 'score score-current' : 'score'}>
          <span
            >${this.localize('chunkScore', undefined, {
              percent: formattedPercent,
            })}</span
          >
          <span part="score-bar" aria-hidden="true"
            ><span
              part="score-fill score-fill-${tone}"
              data-tone=${tone}
              style=${styleMap({ inlineSize: `${percent}%` })}
            ></span
          ></span>
        </div>
        <button
          part="open-button"
          type="button"
          tabindex=${this.chunkTabIndex(index, 'open-button')}
          @focus=${() => this.rememberChunkAction(chunk.id, 'open-button')}
          @keydown=${(event: KeyboardEvent) => this.onChunkActionKey(event, index, 'open-button')}
          aria-label=${getListFormat(this.effectiveLocale, {
            style: 'short',
            type: 'conjunction',
          }).format([
            this.localize('chunkInspectorOpenOrdinal', undefined, {
              index: getNumberFormat(this.effectiveLocale).format(ordinalIndex),
              total: getNumberFormat(this.effectiveLocale).format(ordinalTotal),
            }),
            titleWithPage,
            this.tierLabel(tier),
          ])}
          @click=${() =>
            this.emit('lr-chunk-open', {
              chunkId: chunk.id,
              sourceId: chunk.sourceId,
              ...(chunk.anchor ? { anchor: chunk.anchor } : {}),
            })}
        >
          <span part="title">${titleWithPage}</span>
        </button>
        ${!this.dense
          ? html`<p
                part=${expanded ? 'text' : 'text text-clamped'}
                ?data-clamped=${!expanded}
              >
                ${chunk.text}
              </p>
              <button
                part="toggle"
                type="button"
                tabindex=${this.chunkTabIndex(index, 'toggle')}
                @focus=${() => this.rememberChunkAction(chunk.id, 'toggle')}
                @keydown=${(event: KeyboardEvent) => this.onChunkActionKey(event, index, 'toggle')}
                aria-expanded=${expanded ? 'true' : 'false'}
                aria-label=${this.localize(expanded ? 'retrievalShowLessWithContext' : 'retrievalShowMoreWithContext', undefined, { label: titleWithPage })}
                @click=${() => this.toggleExpand(chunk.id)}
              >
                ${this.localize(expanded ? 'showLess' : 'showMore')}
              </button>`
          : nothing}
      </div>
    `;
  }

  private expandedMembership?: { source: readonly string[]; ids: ReadonlySet<string> };

  private isChunkExpanded(id: string): boolean {
    const source = this.expandedChunkIds;
    // Embedded inspectors usually render one chunk from a much larger expansion collection.
    if (source.length === 0 || this.sortedChunks().length <= 1) {
      this.expandedMembership = undefined;
      return source.includes(id);
    }
    if (this.expandedMembership?.source !== source) {
      this.expandedMembership = { source, ids: new Set(source) };
    }
    return this.expandedMembership.ids.has(id);
  }

  /** Deliberately a *fresh* closure per render, the mirror image of the stable `items`/`chunkKey`
   *  identities above. `<lr-virtual-list>` rebuilds its O(n) offsets/identities whenever either of
   *  those changes identity, but treats a new `renderItem` as nothing more than "re-paint the
   *  visible rows" -- which is exactly the signal a change to this component's own row-affecting
   *  state (expansion, the active row, thresholds, locale) needs, at none of the cost. */
  private virtualRenderItem(): (item: unknown, index: number) => TemplateResult {
    // The virtual list provides the listitem wrapper.
    return (item, index) => this.chunkTemplate(item as LyraChunk, index, true);
  }

  /** The internal virtual list's scroll and range events are not part of this component's surface. */
  private readonly stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private childRegistration?: Promise<unknown>;

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    await this.childRegistration;
    return complete;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.childRegistration = loadLazyChildren('chunk-inspector', this.renderRoot) ?? this.childRegistration;
  }

  override render(): TemplateResult {
    const sorted = this.sortedChunks();
    if (this.expandedMembership?.source !== this.expandedChunkIds || sorted.length <= 1) {
      this.expandedMembership = undefined;
    }
    const label = retrievalSemanticLabel(
      this,
      this.label == null ? this.localize('chunkInspectorLabel') : this.label
    );
    const embedded = this.ordinalIndex !== undefined;
    const groupRole = embedded ? undefined : retrievalSemanticRole(this, 'group');
    if (sorted.length === 0) {
      return html`<div part="base">
        <lr-empty
          part="empty"
          heading=${this.localize('chunkInspectorEmpty')}
        ></lr-empty>
      </div>`;
    }
    return html`
      <div
        part="base"
        role=${groupRole ?? nothing}
        aria-label=${embedded ? nothing : label ?? nothing}
      >
        ${sorted.length > this.effectiveVirtualizeAt
          ? html`<lr-virtual-list
              exportparts="chunk:chunk, chunk-current:chunk-current, score:score, score-current:score-current, score-bar:score-bar, score-fill:score-fill, score-fill-success:score-fill-success, score-fill-warning:score-fill-warning, score-fill-danger:score-fill-danger, open-button:open-button, title:title, text:text, text-clamped:text-clamped, toggle:toggle"
              .items=${sorted}
              .renderItem=${this.virtualRenderItem()}
              .keyFunction=${this.chunkKey}
              .activeItemId=${this.activeChunkId || ''}
              @lr-virtual-scroll=${this.stopOwnedEvent}
              @lr-visible-range-change=${this.onVirtualRange}
              @focusout=${this.rebaseVirtualTabStop}
            ></lr-virtual-list>`
          : html`<div role=${embedded ? nothing : 'list'}>
              ${repeat(sorted, (chunk) => chunk.id, (chunk, index) => this.chunkTemplate(chunk, index, embedded))}
            </div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chunk-inspector': LyraChunkInspector;
  }
}
