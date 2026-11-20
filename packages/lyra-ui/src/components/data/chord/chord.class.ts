import { nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { formatChartValue } from '../../../internal/chart-number-format.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { resolveListMove } from '../../../internal/list-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { SvgChartInteraction, svgChartColor } from '../../../internal/svg-chart.js';
import { svgChartStyles } from '../../../internal/svg-chart.styles.js';
import { layoutChord, type ChordArc, type ChordLayoutResult, type ChordRibbon, type LyraChordEntity } from './chord-layout.js';
import { styles } from './chord.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_queryBuilderValueLabel } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartInputLimit, LYRA_DEFAULT_chartLegend, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_emailViewerFrom, LYRA_DEFAULT_emailViewerTo, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraChordEntity } from './chord-layout.js';

/** The plotted entity or undirected pair activated by pointer or keyboard. */
export type LyraChordDatum =
  | { kind: 'entity'; id: string; label: string; value: number }
  | { kind: 'ribbon'; source: string; target: string; value: number };

export interface LyraChordEventMap {
  'lr-datum-activate': CustomEvent<LyraChordDatum>;
}

const RADIUS = 88;
const OUTER_RADIUS = 101;
const LABEL_RADIUS = 108;
const BOX = 164;
const LABEL_HEIGHT = 18;
const LABEL_WIDTH = 52;

interface LabelBox {
  x: number;
  y: number;
}

function point(angle: number, radius: number, rtl: boolean): readonly [number, number] {
  return [(rtl ? -1 : 1) * radius * Math.sin(angle), -radius * Math.cos(angle)];
}

function pointText(angle: number, radius: number, rtl: boolean): string {
  return point(angle, radius, rtl).join(' ');
}

function arcTo(start: number, end: number, radius: number, rtl: boolean): string {
  const large = Math.abs(end - start) > Math.PI ? 1 : 0;
  const sweep = (end > start) !== rtl ? 1 : 0;
  return `A ${radius} ${radius} 0 ${large} ${sweep} ${pointText(end, radius, rtl)}`;
}

function arcMarkId(id: string): string {
  return `entity:${id}`;
}

function ribbonMarkId(source: string, target: string): string {
  return `ribbon:${JSON.stringify(source < target ? [source, target] : [target, source])}`;
}

/**
 * A peer-free SVG chord chart for symmetric co-occurrence data. The arc of an entity represents
 * its total weight. Each positive unordered pair contributes one ribbon, including self-pairs.
 * Hovering or focusing an entity emphasizes its ribbons.
 *
 * @customElement lr-chord
 * @renderController SvgChartInteraction
 * @event lr-datum-activate - An entity or ribbon was clicked or activated with Enter or Space.
 *   Entity details contain `kind: 'entity'`, `id`, `label`, and `value`. Ribbon details contain
 *   `kind: 'ribbon'`, `source`, `target`, and `value`.
 * @csspart base - The chart container.
 * @csspart plot - The SVG chart.
 * @csspart description - The accessible chart description.
 * @csspart entity - An interactive arc around the ribbon plot.
 * @csspart entity-label - The adjacent entity label when space permits.
 * @csspart ribbon - An interactive pair ribbon.
 * @csspart tooltip - The hovered or focused item’s formatted details.
 * @csspart legend - The key for the entities in the plot.
 * @csspart legend-item - An entry in the key.
 * @csspart legend-swatch - An entry’s color marker.
 * @csspart legend-label - An entry’s name.
 * @csspart data-table - The chart data table.
 * @csspart data-table-toggle - The data table disclosure button.
 * @csspart empty - Shown when no positive weights are available.
 * @csspart loading - Shown while loading is set.
 * @csspart error - Shown for malformed or over-limit input.
 * @csspart limit - Shown when a positive pair cannot be represented in the plot.
 * @status experimental
 * @since unreleased
 */
export class LyraChord extends LyraElement<LyraChordEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    chartData: LYRA_DEFAULT_chartData,
    chartInputLimit: LYRA_DEFAULT_chartInputLimit,
    chartLegend: LYRA_DEFAULT_chartLegend,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    emailViewerFrom: LYRA_DEFAULT_emailViewerFrom,
    emailViewerTo: LYRA_DEFAULT_emailViewerTo,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    queryBuilderValueLabel: LYRA_DEFAULT_queryBuilderValueLabel,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['entities', 'matrix']);

  static override styles = [LyraElement.styles, svgChartStyles, styles];

  /** Entities in matrix order, up to 32, with unique IDs. Assign a new array to update them. */
  @property({ attribute: false }) entities: readonly LyraChordEntity[] = [];

  /** Square symmetric matrix of nonnegative finite weights. Assign a new array to update it. */
  @property({ attribute: false }) matrix: readonly (readonly number[])[] = [];

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
  private ribbonOwnerId?: string;
  private memo?: {
    entities: readonly LyraChordEntity[];
    matrix: readonly (readonly number[])[];
    layout: ChordLayoutResult;
    byId: ReadonlyMap<string, number>;
    incident: ReadonlyMap<string, readonly number[]>;
  };

  private resolveView() {
    if (this.memo?.entities === this.entities && this.memo.matrix === this.matrix) return this.memo;
    const layout = layoutChord(this.entities, this.matrix);
    const byId = new Map(layout.arcs.map((arc, index) => [arc.id, index] as const));
    const incident = new Map<string, number[]>();
    layout.ribbons.forEach(({ source, target }, index) => {
      for (const id of source === target ? [source] : [source, target]) {
        const indices = incident.get(id) ?? [];
        indices.push(index);
        incident.set(id, indices);
      }
    });
    this.memo = { entities: this.entities, matrix: this.matrix, layout, byId, incident };
    return this.memo;
  }

  private navigate(view: NonNullable<LyraChord['memo']>, index: number, key: string): number {
    const { layout: { arcs, ribbons }, byId, incident } = view;
    const ribbon = ribbons[index];
    if (ribbon) {
      const previousOwner = this.ribbonOwnerId;
      const owner = previousOwner && (ribbon.source === previousOwner || ribbon.target === previousOwner)
        ? previousOwner : ribbon.source;
      if (key === 'ArrowUp') return ribbons.length + byId.get(owner)!;
      const siblings = incident.get(owner)!;
      const next = resolveListMove(key, {
        count: siblings.length, current: siblings.indexOf(index), orientation: 'horizontal', wrap: false, clamp: true,
      });
      return next === null ? index : siblings[next]!;
    }
    const arcIndex = index - ribbons.length;
    const arc = arcs[arcIndex];
    if (key === 'ArrowDown' && arc) {
      this.ribbonOwnerId = arc.id;
      return incident.get(arc.id)?.[0] ?? index;
    }
    const next = resolveListMove(key, {
      count: arcs.length, current: arcIndex, orientation: 'horizontal', wrap: false, clamp: true,
    });
    return next === null ? index : ribbons.length + next;
  }

  private arcShape(arc: ChordArc, rtl: boolean, labels: LabelBox[]): TemplateResult {
    const { startAngle, endAngle, label, index } = arc;
    const path = `M ${pointText(startAngle, OUTER_RADIUS, rtl)}
      ${arcTo(startAngle, endAngle, OUTER_RADIUS, rtl)} L ${pointText(endAngle, RADIUS, rtl)}
      ${arcTo(endAngle, startAngle, RADIUS, rtl)} Z`;
    const [x, y] = point((startAngle + endAngle) / 2, LABEL_RADIUS, rtl);
    const side = x > 22 ? 'after' : x < -22 ? 'before' : 'center';
    const left = x - (side === 'before' ? LABEL_WIDTH : side === 'center' ? LABEL_WIDTH / 2 : 0);
    const top = y - LABEL_HEIGHT / 2;
    const fits = label && endAngle - startAngle >= 0.15 && !labels.some(box =>
      Math.abs(box.x - left) < LABEL_WIDTH && Math.abs(box.y - top) < LABEL_HEIGHT
    );
    if (fits) labels.push({ x: left, y: top });
    const align = side === 'center' ? 'center' : (side === 'after') !== rtl ? 'start' : 'end';
    return svg`<path class="arc-shape" d=${path} aria-hidden="true"
      style=${styleMap({ '--_lr-chord-mark-color': svgChartColor(index) })}></path>${fits
      ? svg`<foreignObject class="entity-label-box" x=${left} y=${top} width=${LABEL_WIDTH}
          height=${LABEL_HEIGHT} aria-hidden="true"><div part="entity-label" data-align=${align}>${label}</div></foreignObject>`
      : nothing}`;
  }

  private ribbonShape(ribbon: ChordRibbon, rtl: boolean, highlighted: boolean): TemplateResult {
    const { sourceStartAngle, sourceEndAngle, targetStartAngle, targetEndAngle } = ribbon;
    const path = `M ${pointText(sourceStartAngle, RADIUS, rtl)} ${arcTo(sourceStartAngle, sourceEndAngle, RADIUS, rtl)}
      Q 0 0 ${pointText(targetStartAngle, RADIUS, rtl)} ${arcTo(targetStartAngle, targetEndAngle, RADIUS, rtl)}
      Q 0 0 ${pointText(sourceStartAngle, RADIUS, rtl)} Z`;
    return svg`<path class="ribbon-shape" ?data-highlighted=${highlighted} d=${path} aria-hidden="true"
      style=${styleMap({ '--_lr-chord-mark-color': svgChartColor(ribbon.sourceIndex) })}></path>`;
  }

  override render(): TemplateResult {
    const view = this.loading ? undefined : this.resolveView();
    const arcs = view?.layout.arcs ?? [];
    const ribbons = view?.layout.ribbons ?? [];
    const rtl = this.effectiveDirection === 'rtl';
    const locale = this.effectiveLocale;
    const format = (value: number) => this.valueFormatter?.(value) ?? formatChartValue(value, locale);
    const labelValue = (label: string, value: string) => this.localize('chartValueLabel', undefined, { label, value });
    const active = arcs.find(arc => arcMarkId(arc.id) === this.chart.detailId)?.id;
    const labelBoxes: LabelBox[] = [];
    const pairs = ribbons.map(ribbon => {
      const { source, target, value } = ribbon;
      const sourceLabel = arcs[view!.byId.get(source)!]!.label;
      const targetLabel = arcs[view!.byId.get(target)!]!.label;
      const valueText = format(value);
      const highlighted = active === source || active === target;
      return {
        mark: {
          id: ribbonMarkId(source, target),
          part: 'ribbon',
          label: labelValue(`${sourceLabel} / ${targetLabel}`, valueText),
          muted: active !== undefined && !highlighted,
          shape: this.ribbonShape(ribbon, rtl, highlighted),
        },
        row: [sourceLabel, targetLabel, valueText],
      };
    });
    const entities = arcs.map(arc => ({
      id: arcMarkId(arc.id),
      part: 'entity',
      label: labelValue(arc.label, format(arc.value)),
      shape: this.arcShape(arc, rtl, labelBoxes),
    }));
    const status = view?.layout.status;
    const collectionTruncated = publicCollectionTruncation(this, 'entities') || publicCollectionTruncation(this, 'matrix');
    return this.chart.render({
      name: hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('chart'),
      description: normalizeLabel(this.description) ?? '',
      status: this.loading
        ? { part: 'loading', text: this.localize('loading') }
        : status === 'limit' || collectionTruncated
        ? { part: 'error', text: this.localize('chartInputLimit') }
        : status === 'invalid'
        ? { part: 'error', text: this.localize('valueInvalid') }
        : arcs.length === 0
        ? { part: 'empty', text: this.localize('noData') }
        : undefined,
      notice: view?.layout.truncated && status === 'ready' && !collectionTruncated
        ? this.localize('chartInputLimit')
        : undefined,
      viewBox: `-${BOX} -${BOX} ${BOX * 2} ${BOX * 2}`,
      initialId: entities[0]?.id,
      marks: [...pairs.map(pair => pair.mark), ...entities],
      legend: arcs.map(({ label, index }) => ({ label, color: svgChartColor(index) })),
      legendLabel: this.localize('chartLegend'),
      tableLabel: this.localize('chartData'),
      headers: [this.localize('emailViewerFrom'), this.localize('emailViewerTo'), this.localize('queryBuilderValueLabel')],
      rows: pairs.map(pair => pair.row),
      withDataTable: this.withDataTable,
      dataTableToggle: this.dataTableToggle,
      rtl,
      navigate: view ? (index, key) => this.navigate(view, index, key) : undefined,
      activate: index => {
        const ribbon = ribbons[index];
        const arc = arcs[index - ribbons.length];
        if (ribbon) {
          const { source, target, value } = ribbon;
          this.emit('lr-datum-activate', { kind: 'ribbon', source, target, value });
        } else if (arc) {
          const { id, label, value } = arc;
          this.emit('lr-datum-activate', { kind: 'entity', id, label, value });
        }
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chord': LyraChord;
  }
}
