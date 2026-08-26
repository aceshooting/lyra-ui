import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { styles } from './embedding-explorer.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_embeddingExplorerEmpty, LYRA_DEFAULT_embeddingExplorerLabel, LYRA_DEFAULT_embeddingExplorerPoint } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const WIDTH = 640;
const HEIGHT = 360;
const PAD = 24;
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
}

/**
 * `<lr-embedding-explorer>` — a dependency-free, accessible 2D embedding projection viewer. It
 * normalizes host-provided coordinates into an SVG plot, colors optional clusters, and exposes
 * click/keyboard selection. Pointer, script, and assistive-technology focus all synchronize the
 * single roving tab stop. It does not run PCA/UMAP/t-SNE, fetch chunks, or mutate points.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Points with non-finite coordinates or blank ids and later valid duplicates are ignored before
 * focus, selection, rendering, or activation. The first valid point for an id wins.
 * Optional cluster membership is exposed both through the plot options' descriptions and a
 * visible text legend, so cluster meaning never depends on color alone.
 *
 * @customElement lr-embedding-explorer
 * @event lr-point-select - A point was activated. `detail: { point }`.
 * @csspart base - The root wrapper.
 * @csspart plot - The SVG projection plot.
 * @csspart point - One focusable embedding point.
 * @csspart legend - The visible cluster-name list.
 * @csspart legend-item - One cluster's legend entry.
 * @csspart legend-swatch - One cluster's decorative color swatch.
 * @csspart legend-label - One cluster's visible name.
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
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'points',
  ]);

  static override styles = [LyraElement.styles, specialistTokens, styles];

  /** Projected points in host order. Non-finite coordinates are omitted. */
  @property({ attribute: false }) points: readonly EmbeddingPoint[] = [];
  /** The selected point id. Controlled by the host. */
  @property({ attribute: 'selected-point-id' }) selectedPointId = '';
  /**
   * The plot's block size, as any CSS length the browser accepts for `block-size` — including
   * `auto`, which restores the aspect-ratio-preserved size derived from the `viewBox`. It is
   * applied through `--lr-embedding-explorer-height`; an unparseable value leaves that property
   * unset, so the plot falls back to `auto` rather than collapsing.
   */
  @property() height = '360px';
  /** JS-only accessible name for the plot while no host `aria-label` is authored. An authored host
   *  label governs the plot's name too (including an explicitly empty value), avoiding a competing
   *  generic plot label while still naming the shadow-internal `listbox` itself. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @state() private activeIndex = 0;
  private refocusAfterUpdate = false;

  private get validPoints(): EmbeddingPoint[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.points) ? this.points : [],
      (point) =>
        Number.isFinite(point.x) && Number.isFinite(point.y)
          ? point.id
          : undefined
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!changed.has('points')) return;
    const active = activeElementIn(this.shadowRoot) ?? null;
    const focusedId = active?.getAttribute('data-id');
    const points = this.validPoints;
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
    this.emit('lr-point-select', { point });
  }

  private activatePoint(point: EmbeddingPoint, index: number): void {
    this.activeIndex = index;
    this.select(point);
  }

  private onPointKeyDown(
    event: KeyboardEvent,
    point: EmbeddingPoint,
    index: number
  ): void {
    const points = this.validPoints;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(point);
      return;
    }
    const rtl = this.effectiveDirection === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (event.key === forward || event.key === 'ArrowDown')
      next = Math.min(points.length - 1, index + 1);
    else if (event.key === backward || event.key === 'ArrowUp')
      next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = points.length - 1;
    else return;
    event.preventDefault();
    this.activeIndex = next;
    void this.updateComplete.then(() => {
      this.renderRoot
        .querySelector<SVGCircleElement>(`[data-index="${next}"]`)
        ?.focus();
    });
  }

  private renderPoint(
    point: EmbeddingPoint,
    index: number,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    clusterIndices: Map<string, number>
  ): TemplateResult {
    const { x, y } = this.position(point, bounds);
    const label = this.announceLabel(point, index);
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
      @click=${() => this.activatePoint(point, index)}
      @focus=${() => {
        if (this.activeIndex !== index) this.activeIndex = index;
      }}
      @keydown=${(event: KeyboardEvent) =>
        this.onPointKeyDown(event, point, index)}
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
      <title>${label}</title>
    </g>`;
  }

  override render(): TemplateResult {
    const points = this.validPoints;
    const hostLabel = hostAriaLabel(this);
    const label =
      hostLabel === null
        ? this.accessibleLabel ?? this.localize('embeddingExplorerLabel')
        : hostLabel;
    if (points.length === 0)
      return html`<div part="base" role="region" aria-label=${label}>
        <p part="empty">${this.localize('embeddingExplorerEmpty')}</p>
      </div>`;
    const bounds = points.reduce(
      (result, point) => ({
        minX: Math.min(result.minX, point.x),
        maxX: Math.max(result.maxX, point.x),
        minY: Math.min(result.minY, point.y),
        maxY: Math.max(result.maxY, point.y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );
    const clusters = [
      ...new Set(points.map((point) => String(point.cluster ?? '').trim())),
    ].sort();
    const clusterIndices = new Map(
      clusters.map((cluster, index) => [cluster, index])
    );
    const visibleClusters = clusters.filter((cluster) => cluster.trim() !== '');
    return html`<div part="base">
      <svg
        part="plot"
        viewBox="0 0 ${WIDTH} ${HEIGHT}"
        role="listbox"
        aria-label=${label}
      >
        ${points.map((point, index) =>
          this.renderPoint(point, index, bounds, clusterIndices)
        )}
      </svg>
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
