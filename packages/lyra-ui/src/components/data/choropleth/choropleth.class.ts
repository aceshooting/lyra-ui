import { nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { formatChartValue } from '../../../internal/chart-number-format.js';
import { projectChoroplethNoData } from '../../../internal/choropleth-no-data.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { SvgChartInteraction, svgChartColor, type SvgChartOptions } from '../../../internal/svg-chart.js';
import { svgChartStyles } from '../../../internal/svg-chart.styles.js';
import { decodeChoroplethGeometry, type ChoroplethRegion } from './choropleth-geometry.js';
import {
  layoutChoropleth,
  type ChoroplethLayoutResult,
  type ChoroplethMark,
  type LyraChoroplethPalette,
  type LyraChoroplethProjection,
} from './choropleth-layout.js';
import { styles } from './choropleth.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chartTableName, LYRA_DEFAULT_chartTableValue, LYRA_DEFAULT_choroplethInvalidGeometry } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartInputLimit, LYRA_DEFAULT_chartLegend, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraChoroplethPalette, LyraChoroplethProjection } from './choropleth-layout.js';

/** The paint and caption for a region without a finite numeric value. */
export interface LyraChoroplethNoData {
  readonly color?: string;
  readonly strokeColor?: string;
  readonly label?: string;
}

/** The activated region. A missing numeric value is reported as null. */
export interface LyraChoroplethDatum {
  id: string;
  label: string;
  value: number | null;
}

export interface LyraChoroplethEventMap {
  'lr-datum-activate': CustomEvent<LyraChoroplethDatum>;
}

const PLOT_WIDTH = 320;
const PLOT_HEIGHT = 200;
const LABEL_WIDTH = 56;
const LABEL_HEIGHT = 18;
const MISSING_COLOR = 'var(--lr-color-no-data)';

function regionColor(position: number, palette: LyraChoroplethPalette): string {
  if (palette === 'diverging') {
    const endpoint = svgChartColor(position < 0.5 ? 0 : 1);
    return `color-mix(in oklab, ${endpoint} ${Math.abs(position - 0.5) * 200}%, var(--lr-color-surface-raised))`;
  }
  return `color-mix(in oklab, ${svgChartColor(0)} ${18 + position * 82}%, var(--lr-color-surface))`;
}

/**
 * A peer-free SVG choropleth for caller-supplied GeoJSON or TopoJSON. Regions take a sequential
 * or diverging color from their numeric properties. Keyboard navigation follows source order.
 * Malformed or over-limit geography displays a localized notice. Coordinates must be longitude
 * and latitude, so projected TopoJSON (for example, meters) is rejected as invalid geometry, as is
 * geometry with no drawable area. Features with null, point, or line geometry, and features whose
 * ID exceeds 1,024 UTF-16 code units, are skipped but still count toward the feature limit.
 * Longer labels are truncated.
 *
 * @customElement lr-choropleth
 * @renderController SvgChartInteraction
 * @event lr-datum-activate - A region was clicked or activated with Enter or Space.
 *   Detail contains its `id`, `label`, and `value` (null for missing data).
 * @csspart base - The map container.
 * @csspart plot - The SVG map.
 * @csspart description - The accessible map description.
 * @csspart region - An interactive region.
 * @csspart region-label - A region label where the map has sufficient room.
 * @csspart tooltip - The hovered or focused region’s formatted details.
 * @csspart legend - The scale key and missing-data swatch.
 * @csspart legend-item - An entry in the key.
 * @csspart legend-swatch - An entry’s color marker.
 * @csspart legend-label - An entry’s value or caption.
 * @csspart data-table - The region data table.
 * @csspart data-table-toggle - The data table disclosure button.
 * @csspart empty - Shown when the map has no regions.
 * @csspart loading - Shown while loading is set.
 * @csspart error - Shown for malformed or over-limit geography.
 * @status experimental
 * @since unreleased
 */
export class LyraChoropleth extends LyraElement<LyraChoroplethEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chartData: LYRA_DEFAULT_chartData,
    chartInputLimit: LYRA_DEFAULT_chartInputLimit,
    chartLegend: LYRA_DEFAULT_chartLegend,
    chartTableName: LYRA_DEFAULT_chartTableName,
    chartTableValue: LYRA_DEFAULT_chartTableValue,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    choroplethInvalidGeometry: LYRA_DEFAULT_choroplethInvalidGeometry,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, svgChartStyles, styles];

  /** Parsed geography object. Assign a new object to publish geometry changes. */
  @property({ attribute: false }) geography: unknown;

  /** Feature property containing the numeric value. Changing it reads the current geography again. */
  @property() field = 'value';

  /** Feature property containing the region label. Changing it reads the current geography again. */
  @property({ attribute: 'label-field' }) labelField = 'name';

  /**
   * Name of the one TopoJSON object to draw, such as `'countries'` when a topology also holds an
   * overlapping `'land'` object. The default empty string draws every object. An unknown name
   * shows the empty state. GeoJSON input ignores it.
   */
  @property() object = '';

  /** Projection used to fit the geography into the plot. */
  @property() projection: LyraChoroplethProjection = 'equirectangular';

  /** Numeric color scale. Use a diverging palette to center the scale on zero. */
  @property() palette: LyraChoroplethPalette = 'sequential';

  /** Optional paint and caption overrides for regions whose value is missing. */
  @property({ attribute: false }) noData?: LyraChoroplethNoData;

  /** Accessible map name. A host `aria-label` takes precedence. */
  @property() label = '';

  /** Accessible map description. */
  @property() description = '';

  /** Shows the localized loading state. */
  @property({ type: Boolean }) loading = false;

  /** Displays the data table, or starts it expanded when the toggle is enabled. */
  @property({ type: Boolean, attribute: 'with-data-table' }) withDataTable = false;

  /** Shows a button for expanding and collapsing the data table. */
  @property({ type: Boolean, attribute: 'data-table-toggle' }) dataTableToggle = false;

  /** Formats numeric values in the details, table, and scale key. Defaults to locale-aware formatting. */
  @property({ attribute: false }) valueFormatter?: (value: number) => string;

  private readonly chart = new SvgChartInteraction(this);
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['assertive'] });
  private errorText = '';
  private decoded?: {
    input: unknown;
    field: string;
    labelField: string;
    object: string;
    value: ReturnType<typeof decodeChoroplethGeometry>;
  };
  private projected?: {
    regions: readonly ChoroplethRegion[];
    projection: LyraChoroplethProjection;
    palette: LyraChoroplethPalette;
    value: ChoroplethLayoutResult;
  };
  private missing?: { input: unknown; value?: LyraChoroplethNoData };

  private decode(): ReturnType<typeof decodeChoroplethGeometry> {
    const { geography, field, labelField, object } = this;
    const memo = this.decoded;
    if (memo && memo.input === geography && memo.field === field && memo.labelField === labelField &&
      memo.object === object) return memo.value;
    const value = decodeChoroplethGeometry(geography, field, labelField, object);
    this.decoded = { input: geography, field, labelField, object, value };
    return value;
  }

  private project(regions: readonly ChoroplethRegion[], palette: LyraChoroplethPalette): ChoroplethLayoutResult {
    const projection = this.projection === 'mercator' ? 'mercator' : 'equirectangular';
    const memo = this.projected;
    if (memo && memo.regions === regions && memo.projection === projection && memo.palette === palette) return memo.value;
    const value = layoutChoropleth(regions, PLOT_WIDTH, PLOT_HEIGHT, projection, palette);
    this.projected = { regions, projection, palette, value };
    return value;
  }

  private missingStyle(): LyraChoroplethNoData | undefined {
    const input = this.noData;
    if (this.missing?.input === input) return this.missing?.value;
    const value = projectChoroplethNoData(input);
    this.missing = { input, value };
    return value;
  }

  private regionShape(
    region: ChoroplethMark,
    fill: string,
    stroke: string | undefined,
    labels: [number, number][],
  ): TemplateResult {
    const { path, label, labelX, labelY } = region;
    const x = labelX === null ? null : Math.max(0, Math.min(PLOT_WIDTH - LABEL_WIDTH, labelX - LABEL_WIDTH / 2));
    const y = labelY === null ? null : Math.max(0, Math.min(PLOT_HEIGHT - LABEL_HEIGHT, labelY - LABEL_HEIGHT / 2));
    const fits = label && x !== null && y !== null && !labels.some(([left, top]) =>
      Math.abs(left - x) < LABEL_WIDTH && Math.abs(top - y) < LABEL_HEIGHT
    );
    if (fits) labels.push([x, y]);
    return svg`<path class="region-shape" d=${path} fill-rule="evenodd" aria-hidden="true"
      ?data-missing=${region.value === null}
      style=${styleMap({
        '--_lr-choropleth-fill': fill,
        '--_lr-choropleth-stroke': stroke ?? 'var(--lr-color-border)',
      })}
    ></path>${fits
      ? svg`<foreignObject class="region-label-box" x=${x} y=${y} width=${LABEL_WIDTH}
          height=${LABEL_HEIGHT} aria-hidden="true"><div part="region-label">${label}</div></foreignObject>`
      : nothing}`;
  }

  private chartStatus(
    decoded: ReturnType<typeof decodeChoroplethGeometry>,
    layout: ChoroplethLayoutResult | undefined,
  ): SvgChartOptions['status'] {
    if (this.loading) return { part: 'loading', text: this.localize('loading') };
    if (decoded.status === 'invalid' || layout?.invalid) return { part: 'error', text: this.localize('choroplethInvalidGeometry') };
    if (decoded.status === 'limit') return { part: 'error', text: this.localize('chartInputLimit') };
    if (!layout?.regions.length) return { part: 'empty', text: this.localize('noData') };
    return undefined;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition('geography', this.errorText ? 'error' : 'ready', this.errorText);
  }

  override render(): TemplateResult {
    const decoded = this.decode();
    const palette = this.palette === 'diverging' ? 'diverging' : 'sequential';
    const layout = !this.loading && decoded.status === 'ready' ? this.project(decoded.regions, palette) : undefined;
    const regions = layout?.regions ?? [];
    const missing = this.missingStyle();
    const missingText = missing?.label ?? this.localize('noData');
    const missingColor = missing?.color ?? MISSING_COLOR;
    const locale = this.effectiveLocale;
    const format = (value: number) => this.valueFormatter?.(value) ?? formatChartValue(value, locale);
    const labels: [number, number][] = [];
    const plotted = regions.map(region => {
      const formatted = region.value === null ? missingText : format(region.value);
      const fill = region.position === null ? missingColor : regionColor(region.position, palette);
      return {
        mark: {
          id: region.id,
          part: 'region',
          label: this.localize('chartValueLabel', undefined, { label: region.label, value: formatted }),
          shape: this.regionShape(region, fill, region.value === null ? missing?.strokeColor : undefined, labels),
        },
        row: [region.label, formatted],
      };
    });
    const legend = layout?.stops.map(({ offset, value }) => ({ label: format(value), color: regionColor(offset, palette) })) ?? [];
    if (regions.some(region => region.value === null)) legend.push({ label: missingText, color: missingColor });
    const status = this.chartStatus(decoded, layout);
    this.errorText = status?.part === 'error' ? status.text : '';
    return this.chart.render({
      name: hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('map'),
      description: normalizeLabel(this.description) ?? '',
      status,
      viewBox: `0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`,
      marks: plotted.map(region => region.mark),
      legend,
      legendLabel: this.localize('chartLegend'),
      tableLabel: this.localize('chartData'),
      headers: [this.localize('chartTableName'), this.localize('chartTableValue')],
      rows: plotted.map(region => region.row),
      withDataTable: this.withDataTable,
      dataTableToggle: this.dataTableToggle,
      rtl: this.effectiveDirection === 'rtl',
      activate: index => {
        const region = regions[index];
        if (region) {
          const { id, label, value } = region;
          this.emit('lr-datum-activate', { id, label, value });
        }
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-choropleth': LyraChoropleth;
  }
}
