import { html, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './embedding-explorer.styles.js';

const WIDTH = 640;
const HEIGHT = 360;
const PAD = 24;
const PALETTE = [
  'var(--lr-chart-color-1)',
  'var(--lr-chart-color-2)',
  'var(--lr-chart-color-3)',
  'var(--lr-chart-color-4)',
  'var(--lr-chart-color-5)',
  'var(--lr-chart-color-6)',
  'var(--lr-chart-color-7)',
  'var(--lr-chart-color-8)',
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
 * click/keyboard selection. It does not run PCA/UMAP/t-SNE, fetch chunks, or mutate points.
 *
 * @customElement lr-embedding-explorer
 * @event lr-point-select - A point was activated. `detail: { point }`.
 * @csspart base - The root wrapper.
 * @csspart plot - The SVG projection plot.
 * @csspart point - One focusable embedding point.
 * @csspart empty - The empty state.
 * @cssprop [--lr-embedding-explorer-selected-stroke=var(--lr-color-brand)] - Stroke color of the selected point.
 */
export class LyraEmbeddingExplorer extends LyraElement<LyraEmbeddingExplorerEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Projected points in host order. Non-finite coordinates are omitted. */
  @property({ attribute: false }) points: EmbeddingPoint[] = [];
  /** The selected point id. Controlled by the host. */
  @property({ attribute: 'selected-id' }) selectedId = '';
  /** SVG block size. */
  @property() height = '360px';
  /** Accessible name for the plot. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @state() private activeIndex = 0;
  private refocusAfterUpdate = false;

  private get validPoints(): EmbeddingPoint[] {
    return this.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!changed.has('points')) return;
    const active = this.shadowRoot?.activeElement ?? null;
    const focusedId = active?.getAttribute('data-id');
    const points = this.validPoints;
    const matchingIndex = focusedId ? points.findIndex((point) => point.id === focusedId) : -1;
    this.activeIndex =
      matchingIndex >= 0 ? matchingIndex : Math.min(this.activeIndex, Math.max(0, points.length - 1));
    this.refocusAfterUpdate = active?.getAttribute('part') === 'point';
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!this.refocusAfterUpdate) return;
    this.refocusAfterUpdate = false;
    this.renderRoot.querySelector<SVGGElement>(`[data-index="${this.activeIndex}"]`)?.focus();
  }

  private position(
    point: EmbeddingPoint,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
  ): { x: number; y: number } {
    const { minX, maxX, minY, maxY } = bounds;
    const x = PAD + finiteRange((point.x - minX) / (maxX - minX || 1), 0.5, 0, 1) * (WIDTH - PAD * 2);
    const y = HEIGHT - PAD - finiteRange((point.y - minY) / (maxY - minY || 1), 0.5, 0, 1) * (HEIGHT - PAD * 2);
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

  private onPointKeyDown(event: KeyboardEvent, point: EmbeddingPoint, index: number): void {
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
    if (event.key === forward || event.key === 'ArrowDown') next = Math.min(points.length - 1, index + 1);
    else if (event.key === backward || event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = points.length - 1;
    else return;
    event.preventDefault();
    this.activeIndex = next;
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<SVGCircleElement>(`[data-index="${next}"]`)?.focus();
    });
  }

  private renderPoint(
    point: EmbeddingPoint,
    index: number,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    clusterIndices: Map<string, number>,
  ): TemplateResult {
    const { x, y } = this.position(point, bounds);
    const label = this.announceLabel(point, index);
    const selected = point.id === this.selectedId;
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
      @click=${() => this.select(point)}
      @keydown=${(event: KeyboardEvent) => this.onPointKeyDown(event, point, index)}
    >
      <circle class="point-hit" r="20" fill="transparent"></circle>
      <circle class="point-marker" r="6" fill=${PALETTE[(clusterIndices.get(String(point.cluster ?? '')) ?? 0) % PALETTE.length]}></circle>
      <title>${label}</title>
    </g>`;
  }

  override render(): TemplateResult {
    const points = this.validPoints;
    const label = this.accessibleLabel || this.localize('embeddingExplorerLabel');
    if (points.length === 0) return html`<div part="base" role="region" aria-label=${label}><p part="empty">${this.localize('embeddingExplorerEmpty')}</p></div>`;
    const bounds = points.reduce(
      (result, point) => ({
        minX: Math.min(result.minX, point.x),
        maxX: Math.max(result.maxX, point.x),
        minY: Math.min(result.minY, point.y),
        maxY: Math.max(result.maxY, point.y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );
    const clusters = [...new Set(points.map((point) => String(point.cluster ?? '')))].sort();
    const clusterIndices = new Map(clusters.map((cluster, index) => [cluster, index]));
    return html`<div part="base" role="region" aria-label=${label}>
      <svg part="plot" viewBox="0 0 ${WIDTH} ${HEIGHT}" height=${this.height} role="listbox" aria-label=${label}>
        ${points.map((point, index) => this.renderPoint(point, index, bounds, clusterIndices))}
      </svg>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-embedding-explorer': LyraEmbeddingExplorer;
  }
}
