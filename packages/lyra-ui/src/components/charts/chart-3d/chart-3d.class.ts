import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { literalSetConverter } from '../../../internal/converters.js';
import {
  ENGINE_3D_PREFERENCE,
  ENGINE_3D_REASON_MESSAGE,
  ENGINE_3D_SHOWING_MESSAGE,
  type Engine3dFallbackDetail,
  type Engine3dPreference,
} from '../../../internal/engine-3d.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { resolveListMove } from '../../../internal/list-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import {
  LARGE_DATA_PAGE_SIZE,
  largeDataPage,
  typedColumnIssueMessage,
  type TypedColumnIssue,
} from '../../../internal/typed-columns.js';
import {
  Chart3dRows,
  admitChart3dData,
  chart3dAxisTitle,
  normalizeChart3dAxis,
  normalizeChart3dCamera,
  type Chart3dEngineData,
  type Chart3dType,
  type LyraChart3dAxis,
  type LyraChart3dCamera,
  type LyraChart3dColumns,
} from './chart-3d-data.js';
import { Chart3dEngineController } from './chart-3d-engine.js';
import { styles } from './chart-3d.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chart3dCategory, LYRA_DEFAULT_chart3dEmpty, LYRA_DEFAULT_chart3dFit, LYRA_DEFAULT_chart3dInstructions, LYRA_DEFAULT_chart3dLabel, LYRA_DEFAULT_chart3dName, LYRA_DEFAULT_chart3dRow, LYRA_DEFAULT_chart3dSize, LYRA_DEFAULT_chart3dXAxis, LYRA_DEFAULT_chart3dYAxis, LYRA_DEFAULT_chart3dZAxis } from '../../../internal/default-strings/charts.generated.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_engine3dContextLost, LYRA_DEFAULT_engine3dError, LYRA_DEFAULT_engine3dLoading, LYRA_DEFAULT_engine3dShowingBuiltin, LYRA_DEFAULT_engine3dShowingList, LYRA_DEFAULT_engine3dSoftwareRendering, LYRA_DEFAULT_engine3dUnavailable, LYRA_DEFAULT_engine3dUnsupported, LYRA_DEFAULT_largeDataInvalid, LYRA_DEFAULT_largeDataLimit, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_model, LYRA_DEFAULT_next, LYRA_DEFAULT_open, LYRA_DEFAULT_paginationApplied, LYRA_DEFAULT_paginationLabel, LYRA_DEFAULT_previous } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type {
  Chart3dType,
  LyraChart3dAxis,
  LyraChart3dCamera,
  LyraChart3dColumns,
  LyraChart3dRow,
} from './chart-3d-data.js';

/** Detail of `lr-chart-row-select`: the activated row's ID and its zero-based index in the source columns. */
export interface LyraChart3dSelectDetail {
  readonly id: string;
  readonly index: number;
}

export interface LyraChart3dEventMap {
  'lr-chart-row-select': CustomEvent<LyraChart3dSelectDetail>;
  'lr-camera-change': CustomEvent<{ readonly camera: LyraChart3dCamera }>;
  'lr-engine-fallback': CustomEvent<Engine3dFallbackDetail>;
}

const TYPE = literalSetConverter<Chart3dType>(['scatter', 'bubble', 'line'], 'scatter');
/** Closed message-key table, so the default-string gate can decide every `localize()` key. */
const AXIS_MESSAGE = { x: 'chart3dXAxis', y: 'chart3dYAxis', z: 'chart3dZAxis' } as const;
const MAX_CATEGORY_INDEX = 65535;

const sameAxis = (left: LyraChart3dAxis, right: LyraChart3dAxis): boolean =>
  (left.label ?? '') === (right.label ?? '') && (left.unit ?? '') === (right.unit ?? '');

/**
 * `<lr-chart-3d>` — a bounded three-dimensional scatter, bubble or source-order line chart over
 * immutable typed columns, with an always-available accessible data table and an optional,
 * lazily loaded WebGL renderer.
 *
 * Builtin mode (the default) shows the table and downloads nothing. `engine="webgl"` asks for the
 * optional `@aceshooting/lyra-3d/points` renderer, which loads only once the chart is on screen and
 * the browser can create a WebGL2 context. The table stays available while the renderer loads and
 * whenever it is unavailable, unsupported, lost or failed; there is no other graphical fallback,
 * so a failed renderer descends straight to the table and reports `lr-engine-fallback`.
 *
 * `data` holds up to one million rows as immutable typed columns: unique `ids` and required
 * Float32 `x`, `y` and `z`, plus optional Float32 `size` (CSS-pixel diameters, 0 to 1024),
 * Uint16 `category` with `categories` names, and `labels`. Assign a new object to publish a
 * change. Duplicate IDs, mismatched or non-finite columns and missing coordinates are reported
 * visibly instead of being drawn. `type` selects uniform dots (`scatter`), dots sized by `size`
 * (`bubble`) or lines joining adjacent rows in source order (`line`). Axis extrema and five
 * locale-aware ticks come from the data; coordinates are normalized uniformly with Y inverted,
 * while the table and events keep the source values.
 *
 * Hidden categories remove rows from the view without changing the identity or source index of
 * the rows that remain, and a line breaks at a hidden row. The table shows 200 rows per page and
 * a keyboard cursor reaches every visible row, so no per-row DOM exists beyond the current page.
 * Programmatic writes to `selectedId` and `camera` are silent; user activation emits
 * `lr-chart-row-select`, and camera gestures or the Fit control emit `lr-camera-change`.
 *
 * @customElement lr-chart-3d
 * @event lr-chart-row-select - A user activated a row; detail contains its id and its original zero-based index.
 * @event lr-camera-change - A user gesture or the Fit control moved the camera; detail contains the normalized camera.
 * @event lr-engine-fallback - The WebGL renderer descended to the table; detail contains from, to and reason.
 * @csspart base - The named chart group.
 * @csspart engine - The graphical viewport, present when `engine` is `webgl`.
 * @csspart engine-notice - Localized loading, fallback or software-rendering feedback.
 * @csspart toolbar - The cursor and camera controls.
 * @csspart cursor - The keyboard row cursor; Enter or Space selects its row.
 * @csspart fit-button - The control that frames all visible rows, shown while the renderer is ready.
 * @csspart instructions - The keyboard instructions.
 * @csspart table-container - The scrollable, focusable data-table region.
 * @csspart table - The data table for the current page.
 * @csspart row - A data row.
 * @csspart row-button - The row's selection button.
 * @csspart pagination - The page controls and page summary.
 * @csspart page-button - A previous or next page action.
 * @csspart empty - The empty or fully filtered data state.
 * @csspart error - The invalid-data feedback.
 * @cssprop [--lr-chart-3d-height=24rem] - Block size of the graphical viewport.
 * @cssprop [--lr-chart-3d-point-size=0.5rem] - Diameter of uniform scatter and line points.
 * @cssprop [--lr-chart-3d-line-width=1px] - Width of graphical lines.
 * @status experimental
 * @since unreleased
 */
export class LyraChart3d extends LyraElement<LyraChart3dEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart3dCategory: LYRA_DEFAULT_chart3dCategory,
    chart3dEmpty: LYRA_DEFAULT_chart3dEmpty,
    chart3dFit: LYRA_DEFAULT_chart3dFit,
    chart3dInstructions: LYRA_DEFAULT_chart3dInstructions,
    chart3dLabel: LYRA_DEFAULT_chart3dLabel,
    chart3dName: LYRA_DEFAULT_chart3dName,
    chart3dRow: LYRA_DEFAULT_chart3dRow,
    chart3dSize: LYRA_DEFAULT_chart3dSize,
    chart3dXAxis: LYRA_DEFAULT_chart3dXAxis,
    chart3dYAxis: LYRA_DEFAULT_chart3dYAxis,
    chart3dZAxis: LYRA_DEFAULT_chart3dZAxis,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    engine3dContextLost: LYRA_DEFAULT_engine3dContextLost,
    engine3dError: LYRA_DEFAULT_engine3dError,
    engine3dLoading: LYRA_DEFAULT_engine3dLoading,
    engine3dShowingBuiltin: LYRA_DEFAULT_engine3dShowingBuiltin,
    engine3dShowingList: LYRA_DEFAULT_engine3dShowingList,
    engine3dSoftwareRendering: LYRA_DEFAULT_engine3dSoftwareRendering,
    engine3dUnavailable: LYRA_DEFAULT_engine3dUnavailable,
    engine3dUnsupported: LYRA_DEFAULT_engine3dUnsupported,
    largeDataInvalid: LYRA_DEFAULT_largeDataInvalid,
    largeDataLimit: LYRA_DEFAULT_largeDataLimit,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    model: LYRA_DEFAULT_model,
    next: LYRA_DEFAULT_next,
    open: LYRA_DEFAULT_open,
    paginationApplied: LYRA_DEFAULT_paginationApplied,
    paginationLabel: LYRA_DEFAULT_paginationLabel,
    previous: LYRA_DEFAULT_previous,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles];

  private readonly announcements = new AnnouncementSinkController(this);
  private updatingRenderer = false;
  private readonly renderer = new Chart3dEngineController(this, {
    changed: () => {
      // The controller reports synchronously from inside updated(); Lit reports a new update
      // scheduled there as an inefficiency, so that case waits for the update to finish.
      if (this.updatingRenderer) this.scheduleAfterUpdate(() => this.requestUpdate(), 'engine-state');
      else this.requestUpdate();
    },
    fallback: (detail) => {
      this.announcements.announceAssertive(this.localize(ENGINE_3D_REASON_MESSAGE[detail.reason]));
      this.announcements.announcePolite(this.localize(ENGINE_3D_SHOWING_MESSAGE[detail.to]));
      this.emit('lr-engine-fallback', detail);
    },
    pick: (index) => this.activate(index),
    camera: (camera) => {
      this._camera = camera;
      this.requestUpdate('camera');
      this.emit('lr-camera-change', Object.freeze({ camera }));
    },
  });

  private _data: LyraChart3dColumns | null = null;
  private dataRevision = 0;
  private admitted: LyraChart3dColumns | null = null;
  private rows: Chart3dRows | null = null;
  private issue?: TypedColumnIssue;
  private _engine: Engine3dPreference = 'builtin';
  private _type: Chart3dType = 'scatter';
  private _xAxis: LyraChart3dAxis = Object.freeze({});
  private _yAxis: LyraChart3dAxis = Object.freeze({});
  private _zAxis: LyraChart3dAxis = Object.freeze({});
  private _camera?: LyraChart3dCamera;
  private _hidden: ReadonlySet<number> = new Set();
  private engineData?: Chart3dEngineData;
  private engineInputs: readonly unknown[] = [];

  @state() private cursor = 0;
  @state() private page = 0;
  @state() private focusWithin = false;

  /** Accessible chart name. A host aria-label takes precedence; unset uses the localized default. */
  @property() label?: string;

  /** ID of the selected source row, or empty for none. Programmatic writes do not emit events. */
  @property({ attribute: 'selected-id' }) selectedId = '';

  /**
   * Immutable typed columns, at most one million rows; `x`, `y` and `z` are required. Admission
   * runs once per assigned object, so publish a change by assigning a new object. Column buffers
   * stay caller-owned and must not be mutated afterwards.
   */
  @property({ attribute: false, noAccessor: true })
  get data(): LyraChart3dColumns | null {
    return this._data;
  }
  set data(value: LyraChart3dColumns | null) {
    if (value === this._data) return;
    const previous = this._data;
    const revision = ++this.dataRevision;
    this._data = value;
    this.renderer.invalidate();
    // Disposing a renderer or reading a hostile shell can re-enter this setter; the newest wins.
    if (revision !== this.dataRevision) return;
    const result = value == null ? null : admitChart3dData(value);
    if (revision !== this.dataRevision) return;
    this.issue = result && !result.ok ? result.issue : undefined;
    this.admitted = result?.ok ? result.columns : null;
    this.rebuildRows();
    this.requestUpdate('data', previous);
  }

  /**
   * Preferred renderer. `builtin` (default) shows the accessible table; `webgl` lazily loads the
   * optional points renderer. Anything else normalizes to `builtin`.
   */
  @property({ converter: ENGINE_3D_PREFERENCE, noAccessor: true })
  get engine(): Engine3dPreference {
    return this._engine;
  }
  set engine(value: Engine3dPreference) {
    const next = ENGINE_3D_PREFERENCE.normalize(value);
    if (next === this._engine) return;
    const previous = this._engine;
    this._engine = next;
    this.renderer.invalidate();
    this.requestUpdate('engine', previous);
  }

  /** `scatter` draws uniform dots, `bubble` sizes dots by the `size` column, `line` joins adjacent rows in source order. */
  @property({ converter: TYPE, noAccessor: true })
  get type(): Chart3dType {
    return this._type;
  }
  set type(value: Chart3dType) {
    const next = TYPE.normalize(value);
    if (next === this._type) return;
    const previous = this._type;
    this._type = next;
    this.renderer.invalidate();
    this.requestUpdate('type', previous);
  }

  /** X-axis label and unit; the unset label shows the localized default. */
  @property({ attribute: false, noAccessor: true })
  get xAxis(): LyraChart3dAxis {
    return this._xAxis;
  }
  set xAxis(value: LyraChart3dAxis) {
    const next = normalizeChart3dAxis(value);
    if (sameAxis(next, this._xAxis)) return;
    const previous = this._xAxis;
    this._xAxis = next;
    this.renderer.invalidate();
    this.requestUpdate('xAxis', previous);
  }

  /** Y-axis label and unit. A larger source Y value is drawn higher. */
  @property({ attribute: false, noAccessor: true })
  get yAxis(): LyraChart3dAxis {
    return this._yAxis;
  }
  set yAxis(value: LyraChart3dAxis) {
    const next = normalizeChart3dAxis(value);
    if (sameAxis(next, this._yAxis)) return;
    const previous = this._yAxis;
    this._yAxis = next;
    this.renderer.invalidate();
    this.requestUpdate('yAxis', previous);
  }

  /** Z-axis label and unit. */
  @property({ attribute: false, noAccessor: true })
  get zAxis(): LyraChart3dAxis {
    return this._zAxis;
  }
  set zAxis(value: LyraChart3dAxis) {
    const next = normalizeChart3dAxis(value);
    if (sameAxis(next, this._zAxis)) return;
    const previous = this._zAxis;
    this._zAxis = next;
    this.renderer.invalidate();
    this.requestUpdate('zAxis', previous);
  }

  /**
   * Orbit camera in the chart's normalized world (Y increases downward, angles in radians).
   * Writes are silent. Unset, the renderer frames all visible rows when it mounts.
   */
  @property({ attribute: false, noAccessor: true })
  get camera(): LyraChart3dCamera | undefined {
    return this._camera;
  }
  set camera(value: LyraChart3dCamera | undefined) {
    const previous = this._camera;
    this._camera = value == null ? undefined : normalizeChart3dCamera(value);
    this.requestUpdate('camera', previous);
  }

  /**
   * Category indices (Uint16 values of `data.category`) hidden from the view. Rows keep their IDs
   * and source indices, and lines break at hidden rows. Assign a new set to publish a change;
   * values that are not valid category indices are ignored.
   */
  @property({ attribute: false, noAccessor: true })
  get hiddenCategories(): ReadonlySet<number> {
    return new Set(this._hidden);
  }
  set hiddenCategories(value: ReadonlySet<number>) {
    const hidden = new Set<number>();
    try {
      for (const index of Set.prototype.values.call(value) as Iterable<number>) {
        if (Number.isSafeInteger(index) && index >= 0 && index <= MAX_CATEGORY_INDEX) hidden.add(index);
        if (hidden.size > MAX_CATEGORY_INDEX) break;
      }
    } catch {
      // A value that is not a Set normalizes to no hidden categories.
    }
    if (hidden.size === this._hidden.size && [...hidden].every((index) => this._hidden.has(index))) return;
    const previous = this._hidden;
    this._hidden = hidden;
    this.renderer.invalidate();
    this.rebuildRows();
    this.requestUpdate('hiddenCategories', previous);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnected chart restarts its renderer from the same inputs.
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.renderer.disconnect();
    this.focusWithin = false;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.renderer.disconnect();
    this.announcements.adopted();
    this.requestUpdate();
  }

  /** The chart's accessible name: a host aria-label, else `label`, else the localized default. */
  private get chartName(): string {
    const host = this.getAttribute('aria-label')?.trim();
    if (host) return host;
    return this.label == null ? this.localize('chart3dLabel') : this.label;
  }

  private rebuildRows(): void {
    this.rows = this.admitted ? new Chart3dRows(this.admitted, this._hidden) : null;
    this.cursor = Math.max(0, this.rows?.visibleIndex(this.selectedId) ?? -1);
    this.page = Math.floor(this.cursor / LARGE_DATA_PAGE_SIZE);
    this.engineData = undefined;
    this.engineInputs = [];
  }

  /** Locale-aware number text; negative zero reads as zero, never "-0". */
  private format(value: number): string {
    return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 6 }).format(value === 0 ? 0 : value);
  }

  /** The three axes with the localized default label where the caller gave none. */
  private axes(): LyraChart3dAxis[] {
    return (['x', 'y', 'z'] as const).map((axis) => {
      const given = axis === 'x' ? this._xAxis : axis === 'y' ? this._yAxis : this._zAxis;
      return { label: given.label || this.localize(AXIS_MESSAGE[axis]), unit: given.unit };
    });
  }

  private errorText(): string {
    if (!this.issue) return '';
    const message = typedColumnIssueMessage(this.issue, 'data', (value) => this.format(value));
    return this.localize(message.key === 'largeDataLimit' ? 'largeDataLimit' : 'largeDataInvalid', undefined, message.values);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('selectedId') && this.rows) {
      const index = this.rows.visibleIndex(this.selectedId);
      if (index >= 0) {
        this.cursor = index;
        this.page = Math.floor(index / LARGE_DATA_PAGE_SIZE);
      }
    }
    // Renderer buffers are only prepared for the graphical renderer, and only when an input that
    // reaches them changed: the rows, the type, the locale and the three resolved axis titles.
    const axes = this.axes();
    const inputs = [this.engine, this.rows, this.type, this.effectiveLocale, axes.map(chart3dAxisTitle).join('\u0000')];
    if (inputs.some((value, index) => value !== this.engineInputs[index])) {
      this.engineInputs = inputs;
      this.engineData =
        this.engine === 'webgl' ? this.rows?.data(this.type, axes, (value) => this.format(value)) : undefined;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.updatingRenderer = true;
    try {
      this.renderer.update(
        this.engineData,
        this.renderRoot.querySelector<HTMLElement>('[part="engine"]') ?? undefined,
        this.engine,
        this.rows?.visibleIndex(this.selectedId) ?? -1,
        this.focusWithin ? this.cursor : -1,
        this._camera,
      );
    } finally {
      this.updatingRenderer = false;
    }
    // The first observation of each channel is silent; only later changes are announced.
    this.announcements.transition(
      'engine-loading',
      this.renderer.loading ? 'loading' : 'idle',
      this.renderer.loading ? this.localize('engine3dLoading') : '',
      'polite',
    );
    this.announcements.transition(
      'engine-software',
      this.renderer.software ? 'software' : 'hardware',
      this.renderer.software ? this.localize('engine3dSoftwareRendering') : '',
      'polite',
    );
    const issue = this.issue;
    this.announcements.transition(
      'data-error',
      issue ? `${issue.code}:${issue.column}:${issue.index ?? ''}` : 'valid',
      issue ? this.errorText() : '',
      'assertive',
    );
  }

  /** Frames every visible row. Silent, and independent of any renderer. */
  fit(): void {
    const container = this.renderRoot?.querySelector<HTMLElement>('[part="engine"]');
    const rect = (container ?? this).getBoundingClientRect();
    this.camera = this.rows?.fitCamera(rect.width, rect.height) ?? normalizeChart3dCamera(undefined);
  }

  /**
   * Moves the keyboard cursor and table page to a visible source row and aims the camera at it.
   * Silent, and independent of any renderer. Returns false when the ID is unknown or hidden.
   */
  focusRow(id: string): boolean {
    const index = this.rows?.visibleIndex(id) ?? -1;
    const point = index >= 0 ? this.rows?.position(index) : null;
    if (!point) return false;
    this.setCursor(index);
    this.camera = { ...(this._camera ?? normalizeChart3dCamera(undefined)), target: point };
    return true;
  }

  private setCursor(index: number): void {
    const count = this.rows?.count ?? 0;
    if (!count) return;
    this.cursor = Math.max(0, Math.min(count - 1, index));
    this.page = Math.floor(this.cursor / LARGE_DATA_PAGE_SIZE);
  }

  /** A user move: update the cursor and announce the row it now names. */
  private moveCursor(index: number): void {
    this.setCursor(index);
    this.announcements.announcePolite(this.cursorLabel());
  }

  private cursorLabel(): string {
    const row = this.rows?.row(this.cursor);
    if (!row) return '';
    return this.localize('chart3dRow', undefined, {
      label: row.label,
      index: this.format(this.cursor + 1),
      total: this.format(this.rows?.count ?? 0),
    });
  }

  private activate(index: number): void {
    const row = this.rows?.row(index);
    if (!row) return;
    this.setCursor(index);
    this.selectedId = row.id;
    this.emit('lr-chart-row-select', Object.freeze({ id: row.id, index: row.index }));
  }

  private userFit(): void {
    this.fit();
    if (this._camera) this.emit('lr-camera-change', Object.freeze({ camera: this._camera }));
  }

  private onCursorKeydown(event: KeyboardEvent): void {
    const count = this.rows?.count ?? 0;
    if (!count) return;
    let next = resolveListMove(event, {
      count,
      current: this.cursor,
      orientation: 'both',
      direction: this.effectiveDirection,
      wrap: false,
      clamp: true,
    });
    if (next === null && !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key === 'PageDown') next = Math.min(count - 1, this.cursor + LARGE_DATA_PAGE_SIZE);
      else if (event.key === 'PageUp') next = Math.max(0, this.cursor - LARGE_DATA_PAGE_SIZE);
    }
    if (next === null) return;
    event.preventDefault();
    this.moveCursor(next);
  }

  private engineNotice(): TemplateResult | typeof nothing {
    const notice = this.renderer.notice;
    if (notice) {
      return html`<div part="engine-notice"><p>${this.localize(ENGINE_3D_REASON_MESSAGE[notice.reason])}</p><p>${this.localize(ENGINE_3D_SHOWING_MESSAGE[notice.to])}</p></div>`;
    }
    if (this.renderer.loading) return html`<p part="engine-notice">${this.localize('engine3dLoading')}</p>`;
    if (this.renderer.software) return html`<p part="engine-notice">${this.localize('engine3dSoftwareRendering')}</p>`;
    return nothing;
  }

  private renderTable(rows: Chart3dRows, axes: readonly LyraChart3dAxis[]): TemplateResult {
    const page = largeDataPage(rows.count, this.page);
    const bubble = this.type === 'bubble';
    // The scroll region is a block box: keep its start and end tags flush against the table so no
    // formatting whitespace renders inside a white-space-preserving ancestor.
    return html`<div part="table-container" role="group" tabindex="0" aria-label=${this.chartName}
      ><table part="table">
        <caption>${this.chartName}</caption>
        <thead>
          <tr>
            <th scope="col">${this.localize('chart3dName')}</th>
            ${axes.map((axis) => html`<th scope="col">${chart3dAxisTitle(axis)}</th>`)}
            ${bubble ? html`<th scope="col">${this.localize('chart3dSize')}</th>` : nothing}
            <th scope="col">${this.localize('chart3dCategory')}</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: page.end - page.start }, (_, offset) => {
            const index = page.start + offset;
            const row = rows.row(index)!;
            return html`<tr part="row">
              <th scope="row"><button part="row-button" type="button" data-id=${row.id} aria-pressed=${this.selectedId === row.id ? 'true' : 'false'} @click=${() => this.activate(index)}>${row.label}</button></th>
              <td>${this.format(row.x)}</td>
              <td>${this.format(row.y)}</td>
              <td>${this.format(row.z)}</td>
              ${bubble ? html`<td>${row.size === undefined ? '—' : this.format(row.size)}</td>` : nothing}
              <td>${row.category ?? '—'}</td>
            </tr>`;
          })}
        </tbody>
      </table
    ></div>
    <div part="pagination" role="group" aria-label=${this.localize('paginationLabel')}>
      <button part="page-button" type="button" ?disabled=${page.page === 0} @click=${() => this.moveCursor((page.page - 1) * LARGE_DATA_PAGE_SIZE)}>${this.localize('previous')}</button>
      <span>${this.localize('paginationApplied', undefined, { page: this.format(page.page + 1), totalPages: this.format(page.pageCount) })}</span>
      <button part="page-button" type="button" ?disabled=${page.page + 1 === page.pageCount} @click=${() => this.moveCursor((page.page + 1) * LARGE_DATA_PAGE_SIZE)}>${this.localize('next')}</button>
    </div>`;
  }

  protected override render(): TemplateResult {
    const rows = this.rows;
    const hidden = this.renderer.notice !== null;
    return html`<div
      part="base"
      role="group"
      aria-label=${this.chartName}
      aria-busy=${this.renderer.loading ? 'true' : 'false'}
      @focusin=${() => {
        this.focusWithin = true;
      }}
      @focusout=${(event: FocusEvent) => {
        if (!(event.relatedTarget instanceof Node) || !this.renderRoot.contains(event.relatedTarget)) this.focusWithin = false;
      }}
    >
      <span data-style-probe aria-hidden="true"></span>
      ${this.engineNotice()}
      ${this.issue
        ? html`<p part="error">${this.errorText()}</p>`
        : !rows?.count
          ? html`<p part="empty">${this.localize('chart3dEmpty')}</p>`
          : html`
              ${this.engine === 'webgl' ? html`<div part="engine" aria-hidden="true" ?hidden=${hidden}></div>` : nothing}
              <div part="toolbar">
                <button part="cursor" type="button" aria-describedby="instructions" @keydown=${this.onCursorKeydown} @click=${() => this.activate(this.cursor)}>${this.cursorLabel()}</button>
                ${this.renderer.ready ? html`<button part="fit-button" type="button" @click=${this.userFit}>${this.localize('chart3dFit')}</button>` : nothing}
              </div>
              <p id="instructions" part="instructions">${this.localize('chart3dInstructions')}</p>
              ${this.renderTable(rows, this.axes())}
            `}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chart-3d': LyraChart3d;
  }
}
