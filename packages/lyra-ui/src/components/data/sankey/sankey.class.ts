import { nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { formatChartValue } from '../../../internal/chart-number-format.js';
import { getListFormat } from '../../../internal/intl-cache.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { resolveListMove } from '../../../internal/list-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { SvgChartInteraction, svgChartColor } from '../../../internal/svg-chart.js';
import { svgChartStyles } from '../../../internal/svg-chart.styles.js';
import {
  layoutSankey,
  type LyraSankeyLink,
  type LyraSankeyNode,
  type SankeyLayoutResult,
  type SankeyNodeRect,
  type SankeyRibbon,
} from './sankey-layout.js';
import { styles } from './sankey.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chartTableName, LYRA_DEFAULT_chartTableSource, LYRA_DEFAULT_chartTableTarget, LYRA_DEFAULT_chartTableValue, LYRA_DEFAULT_chartTotalsCaption, LYRA_DEFAULT_flowEdge, LYRA_DEFAULT_flowEdgeWithLabel, LYRA_DEFAULT_sankeyCycle } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartInputLimit, LYRA_DEFAULT_chartLegend, LYRA_DEFAULT_chartTotal, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraSankeyLink, LyraSankeyNode } from './sankey-layout.js';

/** The plotted item activated by pointer or keyboard. */
export type LyraSankeyDatum =
  | { kind: 'node'; id: string; label: string; value: number }
  | { kind: 'link'; id: string; label: string; value: number; source: string; target: string };

export interface LyraSankeyEventMap {
  'lr-datum-activate': CustomEvent<LyraSankeyDatum>;
}

const PLOT_WIDTH = 320;
const PLOT_HEIGHT = 200;
const LABEL_HEIGHT = 18;
const LABEL_GAP = 3;
const MIN_LABEL_WIDTH = 28;
const MAX_LABEL_WIDTH = 96;
const MAX_CYCLE_NAMES = 5;

function plotX(x: number, width: number, rtl: boolean): number {
  return rtl ? PLOT_WIDTH - x - width : x;
}

/**
 * A peer-free SVG Sankey chart for weighted flows across stages. Arrow keys move through the nodes
 * and then the links. A node's value is the larger of its incoming and outgoing totals.
 * Invalid or dangling links are omitted, and cycles render a localized notice naming up to five
 * nodes of one cycle. Node order within a stage reduces flow crossings heuristically: the layout
 * keeps whichever relaxation pass, starting from the input order, crosses the fewest flows.
 *
 * @customElement lr-sankey
 * @renderController SvgChartInteraction
 * @event lr-datum-activate - A node or link was clicked or activated with Enter or Space. Detail
 *   contains its `kind`, `id`, `label`, and `value`. Link details include `source` and `target`.
 * @csspart base - The chart container.
 * @csspart plot - The SVG chart.
 * @csspart description - The accessible chart description.
 * @csspart node - An interactive stage node.
 * @csspart node-label - The visible node label when it has sufficient room.
 * @csspart link - An interactive flow ribbon.
 * @csspart link-label - The authored link label when it has sufficient room.
 * @csspart tooltip - The hovered or focused item’s formatted details.
 * @csspart legend - The key for nodes with outgoing flows.
 * @csspart legend-item - An entry in the key.
 * @csspart legend-swatch - An entry’s color marker.
 * @csspart legend-label - An entry’s name.
 * @csspart data-table - The chart data table.
 * @csspart data-table-toggle - The data table disclosure button.
 * @csspart empty - Shown when there are no nodes to plot.
 * @csspart loading - Shown while loading is set.
 * @csspart error - Shown when the flows contain a cycle.
 * @csspart limit - Shown when an input limit is reached.
 * @status experimental
 * @since unreleased
 */
export class LyraSankey extends LyraElement<LyraSankeyEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    chartData: LYRA_DEFAULT_chartData,
    chartInputLimit: LYRA_DEFAULT_chartInputLimit,
    chartLegend: LYRA_DEFAULT_chartLegend,
    chartTableName: LYRA_DEFAULT_chartTableName,
    chartTableSource: LYRA_DEFAULT_chartTableSource,
    chartTableTarget: LYRA_DEFAULT_chartTableTarget,
    chartTableValue: LYRA_DEFAULT_chartTableValue,
    chartTotal: LYRA_DEFAULT_chartTotal,
    chartTotalsCaption: LYRA_DEFAULT_chartTotalsCaption,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    flowEdge: LYRA_DEFAULT_flowEdge,
    flowEdgeWithLabel: LYRA_DEFAULT_flowEdgeWithLabel,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    sankeyCycle: LYRA_DEFAULT_sankeyCycle,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['nodes', 'links']);

  static override styles = [LyraElement.styles, svgChartStyles, styles];

  /** Nodes referenced by the link endpoints. Assign a new array to update them. */
  @property({ attribute: false }) nodes: readonly LyraSankeyNode[] = [];

  /** Weighted connections between nodes. Assign a new array to update them. */
  @property({ attribute: false }) links: readonly LyraSankeyLink[] = [];

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

  /** Formats numeric values in the table and details. Defaults to locale-aware formatting. */
  @property({ attribute: false }) valueFormatter?: (value: number) => string;

  private readonly chart = new SvgChartInteraction(this);
  private memo?: {
    nodes: readonly LyraSankeyNode[];
    links: readonly LyraSankeyLink[];
    layout: SankeyLayoutResult;
  };

  private resolveLayout(): SankeyLayoutResult {
    if (this.memo?.nodes === this.nodes && this.memo.links === this.links) return this.memo.layout;
    const layout = layoutSankey(this.nodes, this.links, PLOT_WIDTH, PLOT_HEIGHT);
    layout.nodes.sort((left, right) => left.stage - right.stage || left.y - right.y);
    this.memo = { nodes: this.nodes, links: this.links, layout };
    return layout;
  }

  private nodeShape(node: SankeyNodeRect, color: string, stageCount: number, rtl: boolean): TemplateResult {
    const { x, y, width, height, label } = node;
    const end = stageCount > 1 && node.stage === stageCount - 1;
    const labelWidth = Math.min(MAX_LABEL_WIDTH, (PLOT_WIDTH / stageCount - width) * 0.4);
    const labelX = end ? x - labelWidth - LABEL_GAP : x + width + LABEL_GAP;
    // Labels sit on a physical side of their bar after mirroring, so they align toward it physically.
    const align = end === rtl ? 'left' : 'right';
    const labelY = Math.max(0, Math.min(PLOT_HEIGHT - LABEL_HEIGHT, y + (height - LABEL_HEIGHT) / 2));
    return svg`<rect
      class="node-shape" x=${plotX(x, width, rtl)} y=${y} width=${width} height=${height}
      style=${styleMap({ '--_lr-sankey-mark-color': color })} aria-hidden="true"
    ></rect>${label && labelWidth >= MIN_LABEL_WIDTH && height >= LABEL_HEIGHT
      ? svg`<foreignObject
          class="mark-label-box" x=${plotX(labelX, labelWidth, rtl)} y=${labelY}
          width=${labelWidth} height=${LABEL_HEIGHT} aria-hidden="true"
        ><div part="node-label" data-align=${align}>${label}</div></foreignObject>`
      : nothing}`;
  }

  private linkShape(link: SankeyRibbon, color: string, rtl: boolean): TemplateResult {
    const { x1, y1, x2, y2, thickness } = link;
    const fromX = plotX(x1, 0, rtl);
    const toX = plotX(x2, 0, rtl);
    const midX = (fromX + toX) / 2;
    const half = thickness / 2;
    const path = `M ${fromX} ${y1 - half} C ${midX} ${y1 - half} ${midX} ${y2 - half} ${toX} ${y2 - half}
      L ${toX} ${y2 + half} C ${midX} ${y2 + half} ${midX} ${y1 + half} ${fromX} ${y1 + half} Z`;
    const labelWidth = Math.min(MAX_LABEL_WIDTH, Math.abs(toX - fromX) / 2);
    return svg`<path
      class="link-shape" d=${path}
      style=${styleMap({ '--_lr-sankey-mark-color': color })} aria-hidden="true"
    ></path>${link.label && labelWidth >= MIN_LABEL_WIDTH && thickness >= LABEL_HEIGHT
      ? svg`<foreignObject
          class="mark-label-box" x=${midX - labelWidth / 2} y=${(y1 + y2 - LABEL_HEIGHT) / 2}
          width=${labelWidth} height=${LABEL_HEIGHT} aria-hidden="true"
        ><div part="link-label">${link.label}</div></foreignObject>`
      : nothing}`;
  }

  override render(): TemplateResult {
    const layout = this.loading ? undefined : this.resolveLayout();
    const nodes = layout?.nodes ?? [];
    const links = layout?.links ?? [];
    const rtl = this.effectiveDirection === 'rtl';
    const locale = this.effectiveLocale;
    const format = (value: number) => this.valueFormatter?.(value) ?? formatChartValue(value, locale);
    const labelValue = (label: string, value: string) => this.localize('chartValueLabel', undefined, { label, value });
    const byId = new Map(nodes.map((node, index) => [node.id, { ...node, color: svgChartColor(index) }] as const));
    const sourceIds = new Set(links.map(link => link.source));
    const stageCount = nodes.reduce((count, node) => Math.max(count, node.stage + 1), 0);
    const flows = links.map(link => {
      const source = byId.get(link.source)!;
      const target = byId.get(link.target)!;
      const route = { source: source.label, target: target.label };
      const routeLabel = link.label
        ? this.localize('flowEdgeWithLabel', undefined, { ...route, label: link.label })
        : this.localize('flowEdge', undefined, route);
      const value = format(link.value);
      return {
        mark: {
          id: `link:${link.id}`, part: 'link', label: labelValue(routeLabel, value),
          shape: this.linkShape(link, source.color, rtl),
        },
        row: [source.label, target.label, link.label, value],
        detail: {
          kind: 'link' as const, id: link.id, label: link.label || routeLabel, value: link.value,
          source: link.source, target: link.target,
        },
      };
    });
    const nodeMarks = [...byId.values()].map(node => ({
      id: `node:${node.id}`,
      part: 'node',
      label: labelValue(node.label, format(node.value)),
      shape: this.nodeShape(node, node.color, stageCount, rtl),
    }));
    // Paint ribbons behind node targets while exposing keyboard order from the first node.
    const marks = [...flows.map(flow => flow.mark), ...nodeMarks];
    const name = hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('chart');
    return this.chart.render({
      name,
      description: normalizeLabel(this.description) ?? '',
      status: this.loading
        ? { part: 'loading', text: this.localize('loading') }
        : layout?.status === 'cycle'
        ? { part: 'error', text: this.localize('sankeyCycle', undefined, {
          nodes: getListFormat(locale, { type: 'conjunction' })
            .format(layout.cycle.slice(0, MAX_CYCLE_NAMES).map(node => node.label || node.id)),
        }) }
        : nodes.length === 0
        ? { part: 'empty', text: this.localize('noData') }
        : undefined,
      notice: layout?.truncated || publicCollectionTruncation(this, 'nodes') || publicCollectionTruncation(this, 'links')
        ? this.localize('chartInputLimit')
        : undefined,
      viewBox: `0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`,
      initialId: nodeMarks[0]?.id,
      marks,
      legend: [...byId.values()].filter(node => sourceIds.has(node.id)).map(({ label, color }) => ({ label, color })),
      legendLabel: this.localize('chartLegend'),
      tableLabel: this.localize('chartData'),
      headers: [
        this.localize('chartTableSource'), this.localize('chartTableTarget'),
        this.localize('chartTableName'), this.localize('chartTableValue'),
      ],
      rows: flows.map(flow => flow.row),
      totals: {
        caption: this.localize('chartTotalsCaption', undefined, { name }),
        headers: [this.localize('chartTableName'), this.localize('chartTotal')],
        rows: nodes.map(node => [node.label, format(node.value)]),
      },
      withDataTable: this.withDataTable,
      dataTableToggle: this.dataTableToggle,
      rtl,
      navigate: (index, key) => {
        const logical = index < links.length ? nodes.length + index : index - links.length;
        const next = resolveListMove(key, {
          count: marks.length, current: logical, orientation: 'both', wrap: false, clamp: true,
        });
        if (next === null) return index;
        return next < nodes.length ? next + links.length : next - nodes.length;
      },
      activate: index => {
        const flow = flows[index];
        const node = nodes[index - links.length];
        if (flow) this.emit('lr-datum-activate', { ...flow.detail });
        else if (node) this.emit('lr-datum-activate', { kind: 'node', id: node.id, label: node.label, value: node.value });
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sankey': LyraSankey;
  }
}
