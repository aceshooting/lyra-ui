import { html, nothing, svg, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { bdi } from './bidi.js';
import { chartDataTableVisible } from './chart-data-table.js';
import { ENGINE_CHART_PALETTE } from './engine-style.js';
import { isKeyboardFocusEvent, trackInputModality } from './focus-modality.js';
import { isRovingTargetAvailable, resolveListMove, shouldIgnoreNavigationKey } from './list-navigation.js';
import { activateNonmodalOverlay, type OverlayHandle } from './nonmodal-overlay-manager.js';

export function svgChartColor(index: number): string {
  return `var(${ENGINE_CHART_PALETTE[index % ENGINE_CHART_PALETTE.length]})`;
}

export interface SvgChartMark {
  readonly id: string;
  readonly part: string;
  readonly label: string;
  readonly shape: TemplateResult;
  readonly muted?: boolean;
}

export interface SvgChartOptions {
  name: string;
  description: string;
  status?: { part: 'loading' | 'empty' | 'error'; text: string };
  notice?: string;
  viewBox: string;
  marks: readonly SvgChartMark[];
  /** Keyboard entry when SVG paint order puts background ribbons before the first node. */
  initialId?: string;
  legend?: readonly { label: string; color: string }[];
  legendLabel: string;
  tableLabel: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /** Per-item totals (entities, nodes) so the tables together carry everything the plot shows. */
  totals?: SvgChartTable;
  withDataTable: boolean;
  dataTableToggle: boolean;
  rtl: boolean;
  navigate?: (index: number, key: string) => number;
  activate: (index: number) => void;
}

export interface SvgChartTable {
  readonly caption: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

function dataTable(id: string, visible: boolean, table: SvgChartTable): TemplateResult {
  return html`<table part="data-table" id=${id} class=${visible ? nothing : 'sr-only'}>
    <caption>${bdi(table.caption)}</caption>
    <thead><tr>${table.headers.map(header => html`<th scope="col">${bdi(header)}</th>`)}</tr></thead>
    <tbody>${table.rows.map(row => html`<tr>${row.map((cell, i) => i === 0
      ? html`<th scope="row">${bdi(cell)}</th>` : html`<td>${bdi(cell)}</td>`)}</tr>`)}</tbody>
  </table>`;
}

type ChartHost = HTMLElement & ReactiveControllerHost;

/** SVG marks share one keyboard stop. The data table remains readable to assistive technology
 * even when its visual disclosure is collapsed. */
export class SvgChartInteraction implements ReactiveController {
  private focusedId?: string;
  private hoverId?: string;
  private keyboardId?: string;
  private overlay?: OverlayHandle;
  private expanded: boolean | null = null;
  private options?: SvgChartOptions;
  private restoreMarkFocus = false;

  constructor(private readonly host: ChartHost) {
    host.addController(this);
  }

  get detailId(): string | undefined {
    return this.hoverId ?? this.keyboardId;
  }

  hostConnected(): void {
    trackInputModality(this.host.ownerDocument);
  }

  hostUpdated(): void {
    const panel = () => this.host.shadowRoot?.querySelector<HTMLElement>('[part="tooltip"]') ?? null;
    if (this.detailId && !this.overlay && panel()) {
      this.overlay = activateNonmodalOverlay({
        host: this.host, panel, restoreFocusTo: null, onEscape: () => this.clearDetails(),
      });
    } else if (!this.detailId && this.overlay) {
      this.overlay.deactivate({ restoreFocus: false });
      this.overlay = undefined;
    }
    if (this.restoreMarkFocus) {
      this.restoreMarkFocus = false;
      const stop = this.host.shadowRoot?.querySelector<SVGElement>('g[tabindex="0"]');
      // Removing a focused mark commits the new tab stop first. Focus events from the
      // replacement then update its detail outside the host's current render cycle.
      queueMicrotask(() => {
        if (stop?.isConnected && !this.host.shadowRoot?.activeElement) stop.focus();
      });
    }
  }

  hostDisconnected(): void {
    this.overlay?.deactivate({ restoreFocus: false });
    this.overlay = undefined;
    this.clearDetails();
    this.restoreMarkFocus = false;
  }

  private clearDetails(): void {
    if (!this.detailId) return;
    this.hoverId = this.keyboardId = undefined;
    this.host.requestUpdate();
  }

  private focusMark(id: string, event: FocusEvent): void {
    this.focusedId = id;
    this.keyboardId = isKeyboardFocusEvent(event) ? id : undefined;
    this.hoverId = undefined;
    this.host.requestUpdate();
  }

  private keyDown(event: KeyboardEvent, index: number): void {
    const options = this.options;
    if (!options || shouldIgnoreNavigationKey(event)) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) options.activate(index);
      return;
    }
    const key = options.rtl && event.key === 'ArrowLeft' ? 'ArrowRight'
      : options.rtl && event.key === 'ArrowRight' ? 'ArrowLeft' : event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    const marks = this.host.shadowRoot?.querySelectorAll<SVGElement>('g[data-index]');
    const available = (i: number) => !!marks?.[i] && isRovingTargetAvailable(marks[i]!);
    const next = options.navigate?.(index, key) ?? resolveListMove(key, {
      count: options.marks.length, current: index, orientation: 'both', wrap: false, clamp: true, isAvailable: available,
    });
    event.preventDefault();
    if (next !== null && available(next)) marks?.[next]?.focus();
  }

  private mark(mark: SvgChartMark, index: number): TemplateResult {
    return svg`<g part=${mark.part} role="button" aria-label=${mark.label} data-index=${index}
      tabindex=${mark.id === this.focusedId ? 0 : -1} ?data-muted=${mark.muted}
      @focus=${(event: FocusEvent) => this.focusMark(mark.id, event)}
      @blur=${() => {
        if (this.keyboardId === mark.id) {
          this.keyboardId = undefined;
          this.host.requestUpdate();
        }
      }}
      @pointerenter=${() => { this.hoverId = mark.id; this.host.requestUpdate(); }}
      @pointerleave=${(event: PointerEvent) => {
        if (event.relatedTarget === this.host.shadowRoot?.querySelector('[part="tooltip"]')) return;
        this.hoverId = undefined; this.host.requestUpdate();
      }}
      @keydown=${(event: KeyboardEvent) => this.keyDown(event, index)}
      @click=${() => { this.focusedId = mark.id; this.host.requestUpdate(); this.options?.activate(index); }}
    >${mark.shape}</g>`;
  }

  render(options: SvgChartOptions): TemplateResult {
    if (this.options?.withDataTable !== options.withDataTable || this.options?.dataTableToggle !== options.dataTableToggle) {
      this.expanded = null;
    }
    this.options = options;
    const marks = options.status ? [] : options.marks;
    if (!marks.some(mark => mark.id === this.focusedId)) {
      this.restoreMarkFocus = this.host.shadowRoot?.activeElement?.matches('g[data-index]') ?? false;
      this.focusedId = options.initialId && marks.some(mark => mark.id === options.initialId)
        ? options.initialId : marks[0]?.id;
    }
    if (this.keyboardId && !marks.some(mark => mark.id === this.keyboardId)) this.keyboardId = undefined;
    if (this.hoverId && !marks.some(mark => mark.id === this.hoverId)) this.hoverId = undefined;
    const detail = this.detailId && marks.find(mark => mark.id === this.detailId);
    const visible = chartDataTableVisible(options.withDataTable, options.dataTableToggle, this.expanded);
    return html`<div part="base" aria-busy=${options.status?.part === 'loading' ? 'true' : 'false'}>
      ${options.description ? html`<p part="description" id="description">${bdi(options.description)}</p>` : nothing}
      ${options.status ? html`<p part=${options.status.part}>${options.status.text}</p>` : html`
        <div class="graphic"><svg part="plot" role="group" aria-label=${options.name}
          aria-describedby=${options.description ? 'description' : nothing} viewBox=${options.viewBox}
        >${repeat(marks, mark => mark.id, (mark, index) => this.mark(mark, index))}</svg>
        ${detail ? html`<div part="tooltip" role="tooltip"
          @pointerleave=${() => { this.hoverId = undefined; this.host.requestUpdate(); }}
        >${bdi(detail.label)}</div>` : nothing}</div>
        ${options.legend?.length ? html`<ul part="legend" aria-label=${options.legendLabel}>
          ${options.legend.map(entry => html`<li part="legend-item"><span part="legend-swatch" aria-hidden="true"
            style=${styleMap({ backgroundColor: entry.color })}></span><span part="legend-label">${bdi(entry.label)}</span></li>`)}
        </ul>` : nothing}
        ${options.dataTableToggle ? html`<button part="data-table-toggle" type="button" aria-controls=${options.totals ? 'chart-data chart-data-totals' : 'chart-data'}
          aria-expanded=${visible ? 'true' : 'false'}
          @click=${() => { this.expanded = !visible; this.host.requestUpdate(); }}
        >${options.tableLabel}</button>` : nothing}
        ${dataTable('chart-data', visible, { caption: options.name, headers: options.headers, rows: options.rows })}
        ${options.totals ? dataTable('chart-data-totals', visible, options.totals) : nothing}`}
      ${options.notice ? html`<p part="limit" role="note">${options.notice}</p>` : nothing}
    </div>`;
  }
}
