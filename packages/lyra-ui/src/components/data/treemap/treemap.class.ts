import { nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { formatChartValue } from '../../../internal/chart-number-format.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { OwnedResizeObserver } from '../../../internal/owned-observer.js';
import { SvgChartInteraction, svgChartColor } from '../../../internal/svg-chart.js';
import { svgChartStyles } from '../../../internal/svg-chart.styles.js';
import { layoutTreemap, type LyraTreemapNode, type TreemapRect } from './treemap-layout.js';
import { styles } from './treemap.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chartTableName, LYRA_DEFAULT_chartTableValue, LYRA_DEFAULT_chartValuesTooSmall, LYRA_DEFAULT_treemapTileLabel } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_accessibleLabelSeparator, LYRA_DEFAULT_chart, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartInputLimit, LYRA_DEFAULT_chartLegend, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraTreemapNode } from './treemap-layout.js';

export interface LyraTreemapEventMap {
  'lr-datum-activate': CustomEvent<{ id: string; label: string; value: number }>;
}

/** Plot size in CSS pixels until the rendered plot is measured. */
const FALLBACK_WIDTH = 320;
const FALLBACK_HEIGHT = 200;
const MAX_RENDERED_TILES = 1000;

interface Tile extends TreemapRect {
  readonly top: number;
  readonly tileHeight: number;
  readonly contentHeight: number;
  readonly color: string;
  /** Index of this tile's entry in the data table. */
  readonly row: number;
}

interface TreemapRow {
  readonly value: number;
  /** Labels from the top-level ancestor to this node. */
  readonly path: readonly string[];
}

interface TreemapView {
  readonly nodes: readonly LyraTreemapNode[];
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly rows: readonly TreemapRow[];
  readonly byId: ReadonlyMap<string, number>;
  readonly children: ReadonlyMap<string | null, readonly number[]>;
  readonly truncated: boolean;
  readonly tooSmall: boolean;
}

/**
 * Keeps at most `limit` rectangles, level by level and largest first within a level, so every
 * top-level category survives a cap before any descendant is considered. A kept rectangle's
 * parent is always kept, and the parent-first order of the input is preserved.
 */
function capFairly(rects: readonly TreemapRect[], limit: number): readonly TreemapRect[] {
  if (rects.length <= limit) return rects;
  const levels: TreemapRect[][] = [];
  for (const rect of rects) (levels[rect.depth] ??= []).push(rect);
  const kept = new Set<string>();
  for (const level of levels) {
    if (!level) continue;
    for (const rect of [...level].sort((a, b) => b.value - a.value)) {
      if (kept.size >= limit) break;
      if (rect.parentId === null || kept.has(rect.parentId)) kept.add(rect.id);
    }
  }
  return rects.filter(rect => kept.has(rect.id));
}

/**
 * A peer-free SVG treemap. Squarified rectangles show the relative values of the leaves.
 * A branch's value is the sum of its children and its header remains interactive above them.
 * Each top-level tile and its descendants share a legend color.
 *
 * Nodes with invalid values or repeated IDs are omitted. At most 1,000 tiles and table rows
 * render, chosen level by level and largest first so every top-level category remains, with a
 * notice when the chart reaches an input or rendering limit. Values too small to draw remain in
 * the data table, with a separate notice.
 *
 * The plot fills the host's inline size, and its coordinate system follows the rendered size, so
 * tile labels keep their token font size at any width.
 *
 * @customElement lr-treemap
 * @renderController SvgChartInteraction
 * @event lr-datum-activate - A tile was clicked or activated with Enter or Space. Detail contains
 *   the node's `id`, `label`, and numeric `value` (the sum of the children for a branch).
 * @csspart base - The chart container.
 * @csspart plot - The SVG chart.
 * @csspart description - The accessible chart description.
 * @csspart tile - An interactive leaf tile or branch header.
 * @csspart tile-label - The label inside a tile when it has sufficient room.
 * @csspart tooltip - The hovered or focused tile's formatted details.
 * @csspart legend - The key for the top-level categories.
 * @csspart legend-item - A category in the key.
 * @csspart legend-swatch - A category's color marker.
 * @csspart legend-label - A category's name.
 * @csspart data-table - The chart data table.
 * @csspart data-table-toggle - The data table disclosure button.
 * @csspart empty - Shown when no positive values are available.
 * @csspart loading - Shown while loading is set.
 * @csspart limit - Shown when a data or rendering limit is reached.
 * @cssprop [--lr-treemap-height=clamp(var(--lr-size-12rem), 62.5cqi, var(--lr-size-30rem))] - Block size of the plot.
 * @status experimental
 * @since unreleased
 */
export class LyraTreemap extends LyraElement<LyraTreemapEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    accessibleLabelSeparator: LYRA_DEFAULT_accessibleLabelSeparator,
    chart: LYRA_DEFAULT_chart,
    chartData: LYRA_DEFAULT_chartData,
    chartInputLimit: LYRA_DEFAULT_chartInputLimit,
    chartLegend: LYRA_DEFAULT_chartLegend,
    chartTableName: LYRA_DEFAULT_chartTableName,
    chartTableValue: LYRA_DEFAULT_chartTableValue,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    chartValuesTooSmall: LYRA_DEFAULT_chartValuesTooSmall,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    treemapTileLabel: LYRA_DEFAULT_treemapTileLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['nodes']);

  static override styles = [LyraElement.styles, svgChartStyles, styles];

  /** Ordered tree data. Positive finite leaves contribute area. Assign a new array to update it. */
  @property({ attribute: false }) nodes: readonly LyraTreemapNode[] = [];

  /** Accessible chart name. A host `aria-label` takes precedence. */
  @property() label = '';

  /** Accessible chart description. */
  @property() description = '';

  /** Shows the localized loading state. */
  @property({ type: Boolean }) loading = false;

  /** Displays the data table, or starts it expanded when the toggle is enabled. */
  @property({ type: Boolean, attribute: 'with-data-table' }) withDataTable = false;

  /** Shows a button for expanding and collapsing the data table. */
  @property({ type: Boolean, attribute: 'data-table-toggle' }) dataTableToggle = false;

  /** Formats numeric values in the table and tile details. Defaults to locale-aware formatting. */
  @property({ attribute: false }) valueFormatter?: (value: number) => string;

  private readonly chart = new SvgChartInteraction(this);
  private memo?: TreemapView;
  private plotWidth = FALLBACK_WIDTH;
  private plotHeight = FALLBACK_HEIGHT;
  private observedPlot?: Element;
  private readonly plotObserver = new OwnedResizeObserver(this, entries => {
    for (const entry of entries) {
      if (entry.target !== this.observedPlot) continue;
      const { width, height } = entry.contentRect;
      if (!(width > 0 && height > 0)) continue;
      if (Math.abs(width - this.plotWidth) < 0.5 && Math.abs(height - this.plotHeight) < 0.5) continue;
      this.plotWidth = width;
      this.plotHeight = height;
      this.requestUpdate();
    }
  });

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.observePlot();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.plotObserver.clear();
    this.observedPlot = undefined;
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    this.observePlot();
  }

  /** Follows the rendered plot, which is replaced when a status message takes its place. */
  private observePlot(): void {
    const plot = this.shadowRoot?.querySelector('svg[part~="plot"]') ?? undefined;
    if (plot === this.observedPlot) return;
    this.plotObserver.clear();
    this.observedPlot = plot;
    if (plot) this.plotObserver.observe(plot);
  }

  private formatValue(value: number, locale: string): string {
    const formatter = this.valueFormatter;
    if (typeof formatter === 'function') {
      try {
        const text: unknown = formatter(value);
        if (text !== undefined && text !== null) return String(text);
      } catch {
        // A failing formatter falls back to the locale-aware default.
      }
    }
    return formatChartValue(value, locale);
  }

  private resolveView(): TreemapView {
    const width = this.plotWidth;
    const height = this.plotHeight;
    const memo = this.memo;
    if (memo?.nodes === this.nodes && memo.width === width && memo.height === height) return memo;
    let truncated = Boolean(publicCollectionTruncation(this, 'nodes'));
    let tooSmall = false;
    const rects = layoutTreemap(this.nodes, width, height, reason => {
      if (reason === 'input') truncated = true;
      else tooSmall = true;
    });
    const kept = capFairly(rects, MAX_RENDERED_TILES);
    truncated ||= kept.length < rects.length;

    const tiles: Tile[] = [];
    const rows: TreemapRow[] = [];
    const paths = new Map<string, readonly string[]>();
    const byId = new Map<string, number>();
    const children = new Map<string | null, number[]>();
    const rendered: { rect: TreemapRect; row: number }[] = [];
    for (const rect of kept) {
      const parentPath = rect.parentId === null ? undefined : paths.get(rect.parentId);
      const path = parentPath ? [...parentPath, rect.label] : [rect.label];
      paths.set(rect.id, path);
      if (rect.width > 0 && rect.height > 0) rendered.push({ rect, row: rows.length });
      rows.push({ value: rect.value, path });
    }
    const branches = new Set(rendered.map(({ rect }) => rect.parentId));
    for (const { rect, row } of rendered) {
      const parentIndex = rect.parentId === null ? undefined : byId.get(rect.parentId);
      const parent = parentIndex === undefined ? undefined : tiles[parentIndex];
      // Fit the exact partition into the content below its parent's header. Each sibling keeps
      // the same share of the available content, and the headers remain separate pointer targets.
      const top = parent
        ? parent.top + parent.tileHeight + (rect.y - parent.y) / parent.height * parent.contentHeight
        : rect.y;
      const tileBlock = parent ? rect.height / parent.height * parent.contentHeight : rect.height;
      const tileHeight = branches.has(rect.id) ? Math.min(22, tileBlock * 0.3) : tileBlock;
      const siblings = children.get(rect.parentId) ?? [];
      const color = parent?.color ?? svgChartColor(siblings.length);
      byId.set(rect.id, tiles.length);
      siblings.push(tiles.length);
      children.set(rect.parentId, siblings);
      tiles.push({ ...rect, top, tileHeight, contentHeight: tileBlock - tileHeight, color, row });
    }
    this.memo = { nodes: this.nodes, width, height, tiles, rows, byId, children, truncated, tooSmall };
    return this.memo;
  }

  private navigate(view: TreemapView, index: number, key: string): number {
    const tile = view.tiles[index];
    if (!tile) return index;
    if (key === 'ArrowUp') return tile.parentId === null ? index : view.byId.get(tile.parentId) ?? index;
    if (key === 'ArrowDown') return view.children.get(tile.id)?.[0] ?? index;

    const siblings = view.children.get(tile.parentId);
    if (!siblings) return index;
    if (key === 'Home') return siblings[0] ?? index;
    if (key === 'End') return siblings.at(-1) ?? index;
    const next = siblings.indexOf(index) + (key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0);
    return siblings[next] ?? index;
  }

  private renderTile(tile: Tile, plotWidth: number, rtl: boolean): TemplateResult {
    const x = rtl ? plotWidth - tile.x - tile.width : tile.x;
    return svg`
      <rect
        class="tile-shape"
        ?data-branch=${tile.contentHeight > 0}
        x=${x}
        y=${tile.top}
        width=${tile.width}
        height=${tile.tileHeight}
        style=${styleMap({ '--_lr-treemap-tile-color': tile.color })}
        aria-hidden="true"
      ></rect>
      ${tile.width >= 36 && tile.tileHeight >= 18 && tile.label
        ? svg`<foreignObject
            class="tile-label-box"
            x=${x}
            y=${tile.top}
            width=${tile.width}
            height=${tile.tileHeight}
            aria-hidden="true"
          ><div part="tile-label">${tile.label}</div></foreignObject>`
        : nothing}
    `;
  }

  override render(): TemplateResult {
    const view = this.loading ? undefined : this.resolveView();
    const tiles = view?.tiles ?? [];
    const rows = view?.rows ?? [];
    const rtl = this.effectiveDirection === 'rtl';
    const locale = this.effectiveLocale;
    const values = rows.map(row => this.formatValue(row.value, locale));
    const separator = this.localize('accessibleLabelSeparator');
    const names = rows.map(({ path }) => path.length > 1
      ? this.localize('treemapTileLabel', undefined, {
        label: path.at(-1)!, level: path.length, parent: path.slice(0, -1).join(separator),
      })
      : path[0]!);
    return this.chart.render({
      name: hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('chart'),
      description: normalizeLabel(this.description) ?? '',
      status: this.loading
        ? { part: 'loading', text: this.localize('loading') }
        : tiles.length === 0
        ? { part: 'empty', text: this.localize('noData') }
        : undefined,
      notice: view?.truncated ? this.localize('chartInputLimit')
        : view?.tooSmall ? this.localize('chartValuesTooSmall') : undefined,
      viewBox: `0 0 ${view?.width ?? FALLBACK_WIDTH} ${view?.height ?? FALLBACK_HEIGHT}`,
      marks: tiles.map(tile => ({
        id: tile.id,
        part: 'tile',
        label: this.localize('chartValueLabel', undefined, { label: names[tile.row]!, value: values[tile.row]! }),
        shape: this.renderTile(tile, view!.width, rtl),
      })),
      legend: view?.children.get(null)?.map(index => {
        const { label, color } = tiles[index]!;
        return { label, color };
      }),
      legendLabel: this.localize('chartLegend'),
      tableLabel: this.localize('chartData'),
      headers: [this.localize('chartTableName'), this.localize('chartTableValue')],
      rows: rows.map((_, index) => [names[index]!, values[index]!]),
      withDataTable: this.withDataTable,
      dataTableToggle: this.dataTableToggle,
      rtl,
      navigate: view ? (index, key) => this.navigate(view, index, key) : undefined,
      activate: index => {
        const tile = tiles[index];
        if (tile) {
          const { id, label, value } = tile;
          this.emit('lr-datum-activate', { id, label, value });
        }
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-treemap': LyraTreemap;
  }
}
