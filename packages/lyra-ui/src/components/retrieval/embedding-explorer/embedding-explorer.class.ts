import { SpatialSourceController, spatialContains, type SpatialPoint } from '../../../internal/spatial-source-controller.js';
import type { LyraSpatialBounds, LyraSpatialPoint, LyraSpatialPointSource, LyraSpatialBin, LyraSpatialBinSelectDetail } from '../../../utilities/data-spatial.js';
export type { LyraSpatialBounds, LyraSpatialPointSource, LyraSpatialPoint, LyraSpatialBin, LyraSpatialQuery, LyraSpatialBinSelectDetail } from '../../../utilities/data-spatial.js';
import {
  snapshotPublicCollection,
  type CollectionTruncation,
} from '../../../internal/collection-snapshot.js';
import { isPlainDataRecord, readOwnDataValue } from '../../../internal/data-descriptors.js';
import { nativeSvgTitle } from '../../../internal/svg-title.js';
import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { extent, finiteRange, finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import { styles } from './embedding-explorer.styles.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_embeddingExplorerEmpty, LYRA_DEFAULT_embeddingExplorerLabel, LYRA_DEFAULT_embeddingExplorerPoint, LYRA_DEFAULT_embeddingExplorerPointLimit, LYRA_DEFAULT_embeddingExplorerSpatialBin, LYRA_DEFAULT_embeddingExplorerSpatialBounds, LYRA_DEFAULT_embeddingExplorerSpatialError, LYRA_DEFAULT_embeddingExplorerSpatialLoading, LYRA_DEFAULT_embeddingExplorerSpatialSummary } from '../../../internal/default-strings/retrieval.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const WIDTH = 640;
const HEIGHT = 360;
const PAD = 24;
/** Render-scale ceiling for `points`. Above this, `decimatePoints()` selects an evenly spaced
 *  subset spanning the whole input rather than rendering everything, keeping DOM node count and
 *  listener count bounded while spanning source order. Index sampling does not guarantee
 *  preservation of spatial extrema or every cluster. */
const MAX_RENDERED_POINTS = 1_000;
const PALETTE = [
  'var(--lr-color-chart-1)',
  'var(--lr-color-chart-2)',
  'var(--lr-color-chart-3)',
  'var(--lr-color-chart-4)',
  'var(--lr-color-chart-5)',
  'var(--lr-color-chart-6)',
  'var(--lr-color-chart-7)',
  'var(--lr-color-chart-8)',
];

/**
 * Deterministically selects at most `max` items from `items`, evenly spaced across the whole
 * array (always including the first and last item when decimating) rather than truncating to a
 * leading run. This samples source order rather than a spatial density or extremum model.
 */
function decimatePoints<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max || max <= 0) return [...items];
  if (max === 1) return [items[0]!];
  const step = (items.length - 1) / (max - 1);
  const result: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < max; i++) {
    const index = Math.min(items.length - 1, Math.round(i * step));
    if (seen.has(index)) continue;
    seen.add(index);
    result.push(items[index]!);
  }
  return result;
}

interface PointScan {
  readonly source: readonly unknown[];
  readonly length: number;
  readonly candidates: Set<string>;
  readonly winners: Map<string, EmbeddingPoint>;
  cursor: number;
  timer?: ReturnType<typeof setTimeout>;
}

function validPointId(point: unknown): string | undefined {
  if (!isPlainDataRecord(point)) return undefined;
  const id = readOwnDataValue(point, 'id');
  return typeof id === 'string' && id.trim() &&
    Number.isFinite(readOwnDataValue(point, 'x')) && Number.isFinite(readOwnDataValue(point, 'y'))
    ? id : undefined;
}

/** A projected embedding point. Coordinates must already be projected by the host. */
export interface EmbeddingPoint {
  id: string;
  x: number;
  y: number;
  label?: string;
  sourceId?: string;
  cluster?: string | number;
}

export interface LyraEmbeddingExplorerEventMap {
  'lr-point-select': CustomEvent<{ point: EmbeddingPoint }>;
  'lr-spatial-bin-select': CustomEvent<LyraSpatialBinSelectDetail>;
}

/**
 * `<lr-embedding-explorer>` — a dependency-free, accessible 2D embedding projection viewer. It
 * normalizes host-provided coordinates into an SVG plot, colors optional clusters, and exposes
 * click/keyboard selection. Pointer, script, and assistive-technology focus all synchronize the
 * single roving tab stop. It does not run PCA/UMAP/t-SNE, fetch chunks, or mutate points.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes, or explicitly call requestUpdate() to refresh a mutated
 * source. Oversized inputs resolve sampled identities in cancelable chunks; the last completed
 * view stays visible with aria-busy until the replacement is ready. Keep pending source arrays
 * and records unchanged, or reassign/explicitly refresh to restart their staged inspection.
 * Points with non-finite coordinates or blank ids and later valid duplicates are ignored before
 * focus, selection, rendering, or activation. The first valid point for an id wins.
 * Optional cluster membership is exposed both through the plot options' descriptions and a
 * visible text legend, so cluster meaning never depends on color alone.
 *
 * @customElement lr-embedding-explorer
 * @event lr-point-select - A point was activated. `detail: { point }`.
 * @event lr-spatial-bin-select - A density region was activated; detail contains revision, bounds and count.
 * @csspart bin - One focusable density region, distinct from representative point overlays.
 * @csspart error - Invalid or unavailable spatial source feedback.
 * @csspart base - The root wrapper.
 * @csspart plot - The SVG projection plot.
 * @csspart point - One focusable embedding point.
 * @csspart legend - The visible cluster-name list.
 * @csspart legend-item - One cluster's legend entry.
 * @csspart legend-swatch - One cluster's decorative color swatch.
 * @csspart legend-label - One cluster's visible name.
 * @csspart limit - The "showing N of M" notice, present only once `points` exceeds the render
 *   cap. The rendered subset is a deterministic, evenly spaced sample of the full array (not the
 *   leading run). The sample spans source order; it does not guarantee spatial extrema or every
 *   cluster.
 * @csspart empty - The empty state.
 * @cssprop [--lr-embedding-explorer-selected-stroke=var(--lr-color-brand)] - Stroke color of the selected point.
 * @cssprop [--lr-embedding-explorer-height=360px] - The plot's `block-size`. Set on the host from
 *   the `height` property, whose default supplies the `360px`; a value the browser cannot parse as
 *   a `block-size` is dropped, leaving the `viewBox`-derived aspect-ratio size. A consumer's own
 *   `::part(plot) { block-size: ... }` rule still overrides it, and the narrow-allocation
 *   `min-block-size` floor still raises it.
 * @cssprop [--lr-color-chart-1=var(--lr-theme-color-chart-1,#0e006e)] - First cluster color.
 * @cssprop [--lr-color-chart-2=var(--lr-theme-color-chart-2,#4d011a)] - Second cluster color.
 * @cssprop [--lr-color-chart-3=var(--lr-theme-color-chart-3,#862002)] - Third cluster color.
 * @cssprop [--lr-color-chart-4=var(--lr-theme-color-chart-4,#503983)] - Fourth cluster color.
 * @cssprop [--lr-color-chart-5=var(--lr-theme-color-chart-5,#315fdd)] - Fifth cluster color.
 * @cssprop [--lr-color-chart-6=var(--lr-theme-color-chart-6,#935e7c)] - Sixth cluster color.
 * @cssprop [--lr-color-chart-7=var(--lr-theme-color-chart-7,#de6906)] - Seventh cluster color.
 * @cssprop [--lr-color-chart-8=var(--lr-theme-color-chart-8,#8f81d3)] - Eighth cluster color;
 *   later clusters wrap through the same ordered palette.
 * @status stable
 * @since 6.2.0
 */
export class LyraEmbeddingExplorer extends LyraElement<LyraEmbeddingExplorerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    embeddingExplorerEmpty: LYRA_DEFAULT_embeddingExplorerEmpty,
    embeddingExplorerLabel: LYRA_DEFAULT_embeddingExplorerLabel,
    embeddingExplorerPoint: LYRA_DEFAULT_embeddingExplorerPoint,
    embeddingExplorerPointLimit: LYRA_DEFAULT_embeddingExplorerPointLimit,
    embeddingExplorerSpatialBin: LYRA_DEFAULT_embeddingExplorerSpatialBin,
    embeddingExplorerSpatialBounds: LYRA_DEFAULT_embeddingExplorerSpatialBounds,
    embeddingExplorerSpatialError: LYRA_DEFAULT_embeddingExplorerSpatialError,
    embeddingExplorerSpatialLoading: LYRA_DEFAULT_embeddingExplorerSpatialLoading,
    embeddingExplorerSpatialSummary: LYRA_DEFAULT_embeddingExplorerSpatialSummary,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles];

  private spatial = new SpatialSourceController(this, () => this.spatialChanged(), () => this.effectiveLocale);
  private spatialWaiters = new Set<() => void>();
  private revealToken: object = {};
  private _source: LyraSpatialPointSource<EmbeddingPoint & LyraSpatialPoint> | null = null;
  /** Indexed spatial data takes precedence over points. Metadata and payloads are immutable
   * within a revision; assignment or keyless requestUpdate explicitly rebinds. Source mode
   * requires maxRenderedPoints >= 3 and reserves two slots within that budget for exact points. */
  @property({ attribute: false, noAccessor: true })
  get source(): LyraSpatialPointSource<EmbeddingPoint & LyraSpatialPoint> | null { return this._source; }
  set source(value: LyraSpatialPointSource<EmbeddingPoint & LyraSpatialPoint> | null) {
    const old = this._source; this._source = value; this.requestUpdate('source', old);
  }
  /** Visible coordinate bounds, or null for the full global domain. Noncollapsed global axes
   * require positive viewport spans; explicit bounds must stay inside the global domain. */
  @property({ attribute: false }) viewport: LyraSpatialBounds | null = null;

  private spatialChanged(): void {
    super.requestUpdate('spatial');
    if (!this.spatial?.loading || this.spatial.error) {
      for (const resolve of this.spatialWaiters ?? []) resolve();
      this.spatialWaiters?.clear();
    }
  }

  private invalidateReveal(): object {
    const token = this.revealToken = {};
    for (const resolve of this.spatialWaiters ?? []) resolve();
    this.spatialWaiters?.clear();
    return token;
  }

  /** Resolve, reveal and focus an exact original ID without selecting or emitting an event.
   * An explicit viewport pans minimally while preserving its size; a null viewport stays global.
   * Superseded, disconnected, missing or invalid requests resolve false. */
  async revealSourcePoint(id: string): Promise<boolean> {
    const token = this.invalidateReveal();
    const epoch = this.spatial.authority.epoch;
    const current = () => this.revealToken === token && this.isConnected && this.source !== null && this.spatial.authority.epoch === epoch;
    if (!current() || this.spatial.error) return false;
    const point = await this.spatial.reveal(id);
    if (!point || !current()) return false;
    const viewport = this.spatial.panTo(point);
    if (viewport === undefined) return false;
    if (viewport !== this.viewport) this.viewport = viewport;
    await this.updateComplete;
    if (!current()) return false;
    if (this.spatial.loading) await new Promise<void>(resolve => this.spatialWaiters.add(resolve));
    if (!current() || this.spatial.error) return false;
    await this.updateComplete;
    if (!current()) return false;
    const index = this.renderedPoints.findIndex(item => item.id === id);
    if (index < 0) return false;
    this.activeIndex = index;
    await this.updateComplete;
    if (!current()) return false;
    this.renderRoot.querySelector<SVGGElement>(`[data-index="${index}"]`)?.focus();
    return shadowFocusTarget(this)?.getAttribute('data-id') === id;
  }

  private _points: readonly EmbeddingPoint[] = Object.freeze([]);
  private pointsSource: unknown = this._points;
  /** Source length of an assignment too large for one snapshot, else 0. */
  private sampledFrom = 0;
  private pointScan?: PointScan;
  private pointGeneration = 0;
  private resumePointScan = false;
  private validPoints: EmbeddingPoint[] = [];
  private renderedPoints: EmbeddingPoint[] = [];
  private sampledPoints: EmbeddingPoint[] = [];
  private sampledPointSet = new Set<EmbeddingPoint>();
  private pointPositions = new Map<string, { point: EmbeddingPoint; index: number }>();
  private bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  private clusters: string[] = [];

  /** Projected points in host order. Non-finite coordinates are omitted. An input too large for
   *  one snapshot keeps an evenly spaced sample of the whole array, resolving each sampled id to
   *  its first valid source occurrence before publishing the replacement. */
  @property({ attribute: false })
  get points(): readonly EmbeddingPoint[] {
    return this._points;
  }
  set points(value: readonly EmbeddingPoint[]) {
    if (Object.is(value, this.pointsSource) || Object.is(value, this._points)) return;
    this.pointsSource = value;
    if (this.source === null) this.refreshPoints();
  }

  private cancelPointScan(): void {
    this.pointGeneration++;
    clearTimeout(this.pointScan?.timer);
    this.pointScan = undefined;
  }

  private publishPoints(snapshot: readonly EmbeddingPoint[], sourceLength: number): void {
    const previous = this._points;
    this.sampledFrom = sourceLength;
    this._points = snapshot;
    this.requestUpdate('points', previous);
  }

  private refreshPoints(): void {
    this.cancelPointScan();
    this.resumePointScan = false;
    const generation = this.pointGeneration;
    const value = this.pointsSource;
    const view = this.ownerDocument?.defaultView;
    let truncation = undefined as CollectionTruncation | undefined;
    const snapshot = snapshotPublicCollection(value, view, {
      onTruncate: (report) => (truncation = report),
    }) as readonly EmbeddingPoint[];
    if (generation !== this.pointGeneration) return;
    if (!truncation || !Array.isArray(value)) {
      this.publishPoints(snapshot, 0);
      return;
    }
    const candidates = new Set<string>();
    const count = truncation.retained;
    for (let index = 0; index < count; index++) {
      const position = count > 1 ? Math.round(index * (truncation.source - 1) / (count - 1)) : 0;
      const id = validPointId(readOwnDataValue(value, String(position)));
      if (id !== undefined) candidates.add(id);
    }
    if (generation !== this.pointGeneration) return;
    this.pointScan = { source: value, length: truncation.source, candidates, winners: new Map(), cursor: 0 };
    // Preserve the completed view until all sampled identities have their first valid winner.
    // Only the candidate IDs are indexed; the caller continues to own the complete source array.
    this.queuePointScan();
    this.requestUpdate('pointScan');
  }

  private queuePointScan(): void {
    const scan = this.pointScan;
    if (!scan || scan.timer !== undefined || !this.isConnected) return;
    scan.timer = setTimeout(() => {
      scan.timer = undefined;
      if (!this.isConnected || this.pointScan !== scan) return;
      const end = Math.min(scan.length, scan.cursor + 10_000);
      for (; scan.cursor < end && scan.winners.size < scan.candidates.size; scan.cursor++) {
        const point = readOwnDataValue(scan.source, String(scan.cursor));
        const id = validPointId(point);
        if (id !== undefined && scan.candidates.has(id) && !scan.winners.has(id))
          scan.winners.set(id, point as EmbeddingPoint);
      }
      if (scan.cursor < scan.length && scan.winners.size < scan.candidates.size) this.queuePointScan();
      else {
        const snapshot = snapshotPublicCollection([...scan.winners.values()], this.ownerDocument?.defaultView) as readonly EmbeddingPoint[];
        if (this.pointScan !== scan || !this.isConnected) return;
        this.pointScan = undefined;
        this.publishPoints(snapshot, scan.length);
      }
    }, 0);
  }

  override requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: Parameters<LyraElement['requestUpdate']>[2]): void {
    if (this.spatial && (name === 'source' || name === undefined)) {
      this.invalidateReveal();
      this.cancelPointScan();
      this.spatial.bind(this.source, this.viewport, Math.max(1, finiteCount(this.maxRenderedPoints, MAX_RENDERED_POINTS, 10000)), this.selectedPointId);
      if (this.source === null && this.pointsSource !== undefined) this.refreshPoints();
    } else if (this.source && this.spatial) {
      if (name === 'viewport' || name === 'maxRenderedPoints') this.spatial.configure(this.viewport, Math.max(1, finiteCount(this.maxRenderedPoints, MAX_RENDERED_POINTS, 10000)));
      if (name === 'selectedPointId') this.spatial.setSelected(this.selectedPointId);
    } else if (name === undefined && this.pointsSource !== undefined) this.refreshPoints();
    super.requestUpdate(name, oldValue, options);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.source) this.spatial.bind(this.source, this.viewport, Math.max(1, finiteCount(this.maxRenderedPoints, MAX_RENDERED_POINTS, 10000)), this.selectedPointId);
    else if (this.resumePointScan) this.refreshPoints();
    else this.queuePointScan();
  }

  override disconnectedCallback(): void {
    this.invalidateReveal();
    this.spatial.reset();
    this.spatialChanged();
    this.resumePointScan = this.pointScan !== undefined;
    this.cancelPointScan();
    super.disconnectedCallback();
  }
  override adoptedCallback(): void {
    super.adoptedCallback();
    this.spatial.authority.adopted();
    if (this.source) this.spatial.bind(this.source, this.viewport, Math.max(1, finiteCount(this.maxRenderedPoints, MAX_RENDERED_POINTS, 10000)), this.selectedPointId);
  }
  /** Maximum evenly sampled points, from 1 to 10,000; invalid values use 1,000.
   *  The selected point is additionally retained when outside the sample. */
  @property({ type: Number, attribute: 'max-rendered-points' }) maxRenderedPoints = 1000;
  /** The selected point id. Controlled by the host. */
  @property({ attribute: 'selected-point-id' }) selectedPointId = '';
  /**
   * The plot's block size, as any CSS length the browser accepts for `block-size` — including
   * `auto`, which restores the aspect-ratio-preserved size derived from the `viewBox`. It is
   * applied through `--lr-embedding-explorer-height`; an unparseable value leaves that property
   * unset, so the plot falls back to `auto` rather than collapsing.
   */
  @property() height = '360px';
  /** Accessible plot name. A host aria-label takes precedence, including an empty string. */
  @property() label: string | null = null;
  /** Compatibility plot name used when label is absent. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @state() private activeIndex = 0;
  private refocusAfterUpdate = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this.source) {
      this.renderedPoints = [...this.spatial.points()].filter(point => !this.spatial.view || spatialContains(this.spatial.view, point));
      this.activeIndex = Math.max(0, Math.min(this.activeIndex, this.renderedPoints.length + (this.spatial.result?.bins.length ?? 0) - 1));
      return;
    }
    const previousRenderedPoints = this.renderedPoints;
    if (changed.has('points')) {
      this.validPoints = firstByRetrievalIdentity(
        Array.isArray(this.points) ? this.points : [],
        (point) =>
          Number.isFinite(point.x) && Number.isFinite(point.y)
            ? point.id
            : undefined
      );
      this.pointPositions = new Map(this.validPoints.map((point, index) => [point.id, { point, index }]));
      this.bounds = extent(this.validPoints, (point) => point.x, (point) => point.y) ?? {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      };
      this.clusters = [
        ...new Set(this.validPoints.map((point) => String(point.cluster ?? '').trim())),
      ].sort();
    }
    if (changed.has('points') || changed.has('maxRenderedPoints')) {
      this.sampledPoints = decimatePoints(this.validPoints, Math.max(1, finiteCount(this.maxRenderedPoints, MAX_RENDERED_POINTS, 10000)));
      this.sampledPointSet = new Set(this.sampledPoints);
    }
    if (changed.has('points') || changed.has('selectedPointId') || changed.has('maxRenderedPoints')) {
      const selected = this.pointPositions.get(this.selectedPointId);
      this.renderedPoints = this.sampledPoints;
      if (selected && !this.sampledPointSet.has(selected.point)) {
        const following = this.sampledPoints.findIndex(point => this.pointPositions.get(point.id)!.index > selected.index);
        const index = following < 0 ? this.sampledPoints.length : following;
        this.renderedPoints = [...this.sampledPoints.slice(0, index), selected.point, ...this.sampledPoints.slice(index)];
      }
    }
    if (!changed.has('points') && !changed.has('maxRenderedPoints') &&
      previousRenderedPoints === this.renderedPoints) return;
    const active = shadowFocusTarget(this) ?? null;
    const focusedId = active?.getAttribute('data-id');
    const points = this.renderedPoints;
    const matchingIndex = focusedId
      ? points.findIndex((point) => point.id === focusedId)
      : -1;
    this.activeIndex =
      matchingIndex >= 0
        ? matchingIndex
        : Math.min(this.activeIndex, Math.max(0, points.length - 1));
    this.refocusAfterUpdate = active?.getAttribute('part') === 'point';
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('height')) this.applyHeight();
    if (!this.refocusAfterUpdate) return;
    this.refocusAfterUpdate = false;
    this.renderRoot
      .querySelector<SVGGElement>(`[data-index="${this.activeIndex}"]`)
      ?.focus();
  }

  /**
   * Publishes `height` as `--lr-embedding-explorer-height`, which `[part='plot']`'s `block-size`
   * reads. It has to land on the host: custom properties cascade downward into the shadow tree,
   * never upward from a shadow-tree node. Routing it through a custom property rather than an
   * inline `block-size` also keeps the value visible to a consumer retheming the property.
   */
  private applyHeight(): void {
    const height = sanitizeCssLength(this.height, 'height');
    if (height)
      this.style.setProperty('--lr-embedding-explorer-height', height);
    else this.style.removeProperty('--lr-embedding-explorer-height');
  }

  private position(
    point: EmbeddingPoint,
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): { x: number; y: number } {
    const { minX, maxX, minY, maxY } = bounds;
    if (this.source) {
      const ratio = (value: number, min: number, max: number): number => min === max ? 0.5 :
        Number.isFinite(max - min) ? (value - min) / (max - min) : (value / 2 - min / 2) / (max / 2 - min / 2);
      return { x: PAD + ratio(point.x, minX, maxX) * (WIDTH - PAD * 2), y: HEIGHT - PAD - ratio(point.y, minY, maxY) * (HEIGHT - PAD * 2) };
    }
    const x =
      PAD +
      finiteRange((point.x - minX) / (maxX - minX || 1), 0.5, 0, 1) *
        (WIDTH - PAD * 2);
    const y =
      HEIGHT -
      PAD -
      finiteRange((point.y - minY) / (maxY - minY || 1), 0.5, 0, 1) *
        (HEIGHT - PAD * 2);
    return { x, y };
  }

  private announceLabel(point: EmbeddingPoint, index: number): string {
    return this.localize('embeddingExplorerPoint', undefined, {
      label: point.label || point.id,
      index: getNumberFormat(this.effectiveLocale).format(index + 1),
    });
  }

  private select(point: EmbeddingPoint): void {
    if (this.source && (this.spatial.loading || this.spatial.error)) return;
    this.emit('lr-point-select', { point });
  }

  private activatePoint(point: EmbeddingPoint, index: number): void {
    this.activeIndex = index;
    this.select(point);
  }

  private onPointKeyDown(
    event: KeyboardEvent,
    point: EmbeddingPoint,
    index: number,
    current: () => boolean = () => true
  ): void {
    const points = this.renderedPoints;
    const total = points.length + (this.source ? this.spatial.result?.bins.length ?? 0 : 0);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) this.select(point);
      return;
    }
    const rtl = this.effectiveDirection === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (event.key === forward || event.key === 'ArrowDown')
      next = Math.min(total - 1, index + 1);
    else if (event.key === backward || event.key === 'ArrowUp')
      next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = total - 1;
    else return;
    event.preventDefault();
    this.activeIndex = next;
    void this.updateComplete.then(() => {
      if (!current()) return;
      this.renderRoot
        .querySelector<SVGCircleElement>(`[data-index="${next}"]`)
        ?.focus();
    });
  }

  private spatialActionGuard(member: () => boolean): (event?: Event) => boolean {
    const source = this.source, model = this.spatial;
    const binding = model.binding, result = model.result, owner = this.ownerDocument;
    const epoch = model.authority.epoch;
    return (event?: Event): boolean => {
      const control = event?.currentTarget as Element | null | undefined;
      return source !== null && this.source === source && this.isConnected && this.ownerDocument === owner &&
        model.binding === binding && model.result === result && model.authority.epoch === epoch &&
        !model.loading && !model.error && member() &&
        (!event || !!control?.isConnected && control.ownerDocument === owner && control.getRootNode() === this.renderRoot);
    };
  }

  private renderPoint(
    point: EmbeddingPoint,
    index: number,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    clusterIndices: Map<string, number>
  ): TemplateResult {
    const current = this.source ? this.spatialActionGuard(() =>
      this.spatial.result?.points.includes(point as SpatialPoint) === true || this.spatial.selected === point || this.spatial.revealed === point
    ) : () => true;
    const { x, y } = this.position(point, bounds);
    const label = this.announceLabel(point, this.source ? (point as SpatialPoint).sourceIndex : index);
    const cluster = String(point.cluster ?? '').trim();
    const selected = point.id === this.selectedPointId;
    return svg`<g
      part="point"
      data-index=${index}
      data-id=${point.id}
      data-selected=${selected ? 'true' : 'false'}
      transform="translate(${x} ${y})"
      tabindex=${index === this.activeIndex ? '0' : '-1'}
      role="option"
      aria-selected=${selected ? 'true' : 'false'}
      aria-label=${label}
      aria-description=${cluster || nothing}
      @click=${(event: MouseEvent) => { if (current(event)) this.activatePoint(point, index); }}
      @focus=${(event: FocusEvent) => {
        if (!current(event)) return;
        if (this.activeIndex !== index) this.activeIndex = index;
      }}
      @keydown=${(event: KeyboardEvent) =>
        current(event) && this.onPointKeyDown(event, point, index, current)}
    >
      <line
        class="point-hit"
        x1="0"
        y1="0"
        x2="0"
        y2="0"
        aria-hidden="true"
        focusable="false"
        vector-effect="non-scaling-stroke"
      ></line>
      <circle class="point-marker" r="6" fill=${
        PALETTE[(clusterIndices.get(cluster) ?? 0) % PALETTE.length]
      }></circle>
      ${nativeSvgTitle(label)}
    </g>`;
  }

  private activateBin(bin: LyraSpatialBin): void {
    const binding = this.spatial.binding;
    if (!binding || this.spatial.loading || this.spatial.error) return;
    this.emit('lr-spatial-bin-select', Object.freeze({ revision: binding.revision, bounds: bin.bounds, count: bin.count }));
  }

  private renderSpatial(): TemplateResult {
    const model = this.spatial, binding = model.binding, view = model.view;
    const label = this.hasAttribute('aria-label') ? this.getAttribute('aria-label')! : this.label ?? this.accessibleLabel ?? this.localize('embeddingExplorerLabel');
    const number = getNumberFormat(this.effectiveLocale);
    const formatBounds = (bounds: LyraSpatialBounds | null | undefined): string => bounds ?
      this.localize('embeddingExplorerSpatialBounds', undefined, { minX: number.format(bounds.minX), maxX: number.format(bounds.maxX), minY: number.format(bounds.minY), maxY: number.format(bounds.maxY) }) : this.localize('embeddingExplorerEmpty');
    const summary = this.localize('embeddingExplorerSpatialSummary', undefined, { total: number.format(binding?.count ?? 0), matched: number.format(model.result?.matchedCount ?? 0), global: formatBounds(binding?.bounds), viewport: formatBounds(view) });
    const points = this.renderedPoints;
    const bins = model.result?.bins ?? [];
    return html`<div part="base" role="region" aria-label=${label} aria-busy=${model.loading ? 'true' : 'false'}>
      ${model.error ? html`<p part="error">${this.localize('embeddingExplorerSpatialError')}</p>` : nothing}
      ${view && model.result && !model.error ? html`<svg part="plot" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="listbox" aria-label=${label} aria-description=${summary} aria-disabled=${model.loading ? 'true' : 'false'}>
        ${bins.map((bin, offset) => {
          const a = this.position({ id: '', x: bin.bounds.minX, y: bin.bounds.maxY }, view);
          const b = this.position({ id: '', x: bin.bounds.maxX, y: bin.bounds.minY }, view);
          const index = points.length + offset;
          const current = this.spatialActionGuard(() => this.spatial.result?.bins.includes(bin) === true);
          const name = this.localize('embeddingExplorerSpatialBin', undefined, { count: number.format(bin.count), bounds: formatBounds(bin.bounds) });
          return svg`<g part="bin" role="option" aria-selected="false" aria-label=${name} tabindex=${index === this.activeIndex ? '0' : '-1'} data-index=${index}
            @focus=${(event: FocusEvent) => { if (current(event)) this.activeIndex = index; }} @click=${(event: MouseEvent) => { if (current(event)) { this.activeIndex = index; this.activateBin(bin); } }}
            @keydown=${(event: KeyboardEvent) => {
              if (!current(event)) return;
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) this.activateBin(bin); }
              else this.onPointKeyDown(event, { id: '', x: 0, y: 0 }, index, current);
            }}>
            <rect class="bin-region" x=${a.x} y=${a.y} width=${b.x - a.x} height=${b.y - a.y} fill-opacity=${0.15 + 0.65 * bin.count / Math.max(1, model.result!.matchedCount)}></rect>
            <line class=${bin.bounds.minX === bin.bounds.maxX || bin.bounds.minY === bin.bounds.maxY ? 'bin-hit bin-axis' : 'bin-hit'} x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y} aria-hidden="true"></line>
            ${nativeSvgTitle(name)}
          </g>`;
        })}
        ${points.map((point, index) => this.renderPoint(point, index, view, new Map()))}
      </svg>` : nothing}
      ${model.loading ? html`<p part="limit">${this.localize('embeddingExplorerSpatialLoading')}</p>` : html`<p part="limit">${summary}</p>`}
      ${!model.loading && !model.error && binding?.count === 0 ? html`<p part="empty">${this.localize('embeddingExplorerEmpty')}</p>` : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    if (this.source) return this.renderSpatial();
    const points = this.validPoints;
    const label = this.hasAttribute('aria-label')
      ? this.getAttribute('aria-label')!
      : this.label ?? this.accessibleLabel ?? this.localize('embeddingExplorerLabel');
    if (points.length === 0)
      return html`<div part="base" role="region" aria-label=${label} aria-busy=${this.pointScan ? 'true' : 'false'}>
        ${this.pointScan ? nothing : html`<p part="empty">${this.localize('embeddingExplorerEmpty')}</p>`}
      </div>`;
    const renderedPoints = this.renderedPoints;
    const bounds = this.bounds;
    const clusters = this.clusters;
    const clusterIndices = new Map(
      clusters.map((cluster, index) => [cluster, index])
    );
    const visibleClusters = clusters.filter((cluster) => cluster.trim() !== '');
    const numberFormat = getNumberFormat(this.effectiveLocale);
    return html`<div part="base" aria-busy=${this.pointScan ? 'true' : 'false'}>
      <svg
        part="plot"
        viewBox="0 0 ${WIDTH} ${HEIGHT}"
        role="listbox"
        aria-label=${label}
      >
        ${renderedPoints.map((point, index) =>
          this.renderPoint(point, index, bounds, clusterIndices)
        )}
      </svg>
      ${renderedPoints.length < (this.sampledFrom || points.length)
        ? html`<p part="limit" role="note">${this.localize('embeddingExplorerPointLimit', undefined, {
              shown: numberFormat.format(renderedPoints.length),
              total: numberFormat.format(this.sampledFrom || points.length),
            })}</p>`
        : nothing}
      ${visibleClusters.length > 0
        ? html`<div part="legend" role="list">
            ${visibleClusters.map(
              (cluster) => html`<span
                part="legend-item"
                role="listitem"
                data-cluster=${cluster}
              >
                <svg
                  part="legend-swatch"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill=${PALETTE[
                      (clusterIndices.get(cluster) ?? 0) % PALETTE.length
                    ]}
                  ></circle>
                </svg>
                <span part="legend-label">${cluster}</span>
              </span>`
            )}
          </div>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-embedding-explorer': LyraEmbeddingExplorer;
  }
}
