import { nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { formatChartValue } from '../../../internal/chart-number-format.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { SvgChartInteraction, svgChartColor } from '../../../internal/svg-chart.js';
import { svgChartStyles } from '../../../internal/svg-chart.styles.js';
import { layoutTreemap, type LyraTreemapNode, type TreemapRect } from './treemap-layout.js';
import { styles } from './treemap.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_queryBuilderValueLabel } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chart3dName, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartInputLimit, LYRA_DEFAULT_chartLegend, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraTreemapNode } from './treemap-layout.js';

export interface LyraTreemapEventMap {
  'lr-datum-activate': CustomEvent<{ id: string; label: string; value: number }>;
}

const PLOT_WIDTH = 320;
const PLOT_HEIGHT = 200;
const MAX_RENDERED_TILES = 1000;

interface Tile extends TreemapRect {
  readonly top: number;
  readonly tileHeight: number;
  readonly contentHeight: number;
  readonly color: string;
  readonly path: string;
}

interface TreemapView {
  readonly nodes: readonly LyraTreemapNode[];
  readonly tiles: readonly Tile[];
  readonly byId: ReadonlyMap<string, number>;
  readonly children: ReadonlyMap<string | null, readonly number[]>;
  readonly truncated: boolean;
}

/**
 * A peer-free SVG treemap. Squarified rectangles show the relative values of the leaves.
 * A branch's value is the sum of its children and its header remains interactive above them.
 * Each top-level tile and its descendants share a legend color.
 *
 * Nodes with invalid values or repeated IDs are omitted. At most 1,000 tiles and table rows
 * render, with a notice when the chart reaches an input or rendering limit.
 *
 * @customElement lr-treemap
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
 * @status experimental
 * @since unreleased
 */
export class LyraTreemap extends LyraElement<LyraTreemapEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    chart3dName: LYRA_DEFAULT_chart3dName,
    chartData: LYRA_DEFAULT_chartData,
    chartInputLimit: LYRA_DEFAULT_chartInputLimit,
    chartLegend: LYRA_DEFAULT_chartLegend,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    queryBuilderValueLabel: LYRA_DEFAULT_queryBuilderValueLabel,
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

  private resolveView(): TreemapView {
    if (this.memo?.nodes === this.nodes) return this.memo;
    let truncated = Boolean(publicCollectionTruncation(this, 'nodes'));
    const rects = layoutTreemap(this.nodes, PLOT_WIDTH, PLOT_HEIGHT, () => { truncated = true; });
    truncated ||= rects.length > MAX_RENDERED_TILES;

    const tiles: Tile[] = [];
    const byId = new Map<string, number>();
    const children = new Map<string | null, number[]>();
    const rendered = rects.slice(0, MAX_RENDERED_TILES);
    const branches = new Set(rendered.map(rect => rect.parentId));
    for (const rect of rendered) {
      const parentIndex = rect.parentId === null ? undefined : byId.get(rect.parentId);
      const parent = parentIndex === undefined ? undefined : tiles[parentIndex];
      // Fit the exact partition into the content below its parent's header. Each sibling keeps
      // the same share of the available content, and the headers remain separate pointer targets.
      const top = parent
        ? parent.top + parent.tileHeight + (rect.y - parent.y) / parent.height * parent.contentHeight
        : rect.y;
      const height = parent ? rect.height / parent.height * parent.contentHeight : rect.height;
      const tileHeight = branches.has(rect.id) ? Math.min(22, height * 0.3) : height;
      const siblings = children.get(rect.parentId) ?? [];
      const color = parent?.color ?? svgChartColor(siblings.length);
      const path = parent ? `${parent.path} / ${rect.label}` : rect.label;
      byId.set(rect.id, tiles.length);
      siblings.push(tiles.length);
      children.set(rect.parentId, siblings);
      tiles.push({ ...rect, top, tileHeight, contentHeight: height - tileHeight, color, path });
    }
    this.memo = { nodes: this.nodes, tiles, byId, children, truncated };
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

  private renderTile(tile: Tile, rtl: boolean): TemplateResult {
    const x = rtl ? PLOT_WIDTH - tile.x - tile.width : tile.x;
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
    const rtl = this.effectiveDirection === 'rtl';
    const locale = this.effectiveLocale;
    const values = tiles.map(tile =>
      this.valueFormatter?.(tile.value) ?? formatChartValue(tile.value, locale)
    );
    return this.chart.render({
      name: hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('chart'),
      description: normalizeLabel(this.description) ?? '',
      status: this.loading
        ? { part: 'loading', text: this.localize('loading') }
        : tiles.length === 0
        ? { part: 'empty', text: this.localize('noData') }
        : undefined,
      notice: view?.truncated ? this.localize('chartInputLimit') : undefined,
      viewBox: `0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`,
      marks: tiles.map((tile, index) => ({
        id: tile.id,
        part: 'tile',
        label: this.localize('chartValueLabel', undefined, { label: tile.label, value: values[index]! }),
        shape: this.renderTile(tile, rtl),
      })),
      legend: view?.children.get(null)?.map(index => {
        const { label, color } = tiles[index]!;
        return { label, color };
      }),
      legendLabel: this.localize('chartLegend'),
      tableLabel: this.localize('chartData'),
      headers: [this.localize('chart3dName'), this.localize('queryBuilderValueLabel')],
      rows: tiles.map((tile, index) => [tile.path, values[index]!]),
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
