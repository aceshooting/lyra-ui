import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { FlowHandle, FlowRunStatus } from '../flow-canvas/flow-canvas.class.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './flow-node.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_flowInputHandle, LYRA_DEFAULT_flowOutputHandle, LYRA_DEFAULT_flowStatusWithDetail, LYRA_DEFAULT_flowStatusWithDuration, LYRA_DEFAULT_progress, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const DEFAULT_INPUTS: FlowHandle[] = [{ id: 'in' }];
const DEFAULT_OUTPUTS: FlowHandle[] = [{ id: 'out' }];

/**
 * `<lr-flow-node>` — the card a workflow node renders as: header/body/toolbar chrome,
 * tool-lifecycle status tones, and the named connection-handle elements edges anchor to. Used as
 * `lr-flow-canvas`'s default card and as a slotted override; also renders standalone (palette
 * previews, docs). Purely presentational — activation, selection, movement, and connection are all
 * `lr-flow-canvas` events; this component owns none of that.
 *
 * @customElement lr-flow-node
 * @slot - Body content.
 * @slot icon - Leading header glyph.
 * @slot header - Replaces the built-in heading row entirely.
 * @slot toolbar - Action row at the block-end edge.
 * @csspart base - The row wrapping the input handles, the card, and the output handles. Carries no
 *   card chrome of its own — style the card itself through the `card` part.
 * @csspart card - The bordered, filled node card.
 * @csspart header - The built-in header row (omitted when the `header` slot has content).
 * @csspart icon - The wrapper around the `icon` slot.
 * @csspart heading - The heading text.
 * @csspart status - The visible status chip (status is never color-only).
 * @csspart progress - The determinate progress bar.
 * @csspart body - The default-slot body wrapper.
 * @csspart toolbar - The toolbar row wrapper.
 * @csspart handle - Every handle dot (input or output).
 * @csspart handle-input - An input handle dot (also carries the shared `handle` part).
 * @csspart handle-output - An output handle dot (also carries the shared `handle` part).
 * @cssprop [--lr-flow-node-min-inline-size=calc(var(--lr-size-10rem) + var(--lr-size-1rem))] - Minimum card inline size.
 * @cssprop [--lr-flow-node-compact-padding=var(--lr-space-xs)] - `[part="card"]` padding while
 *   `compact`.
 * @cssprop [--lr-flow-node-compact-gap=var(--lr-space-2xs)] - Gap between `[part="card"]`'s rows
 *   while `compact`.
 * @cssprop [--lr-flow-node-selected-border=var(--lr-color-brand)] - Border color of the card while
 *   `selected`. Overriding the selection color otherwise requires hijacking the library-wide
 *   `--lr-color-brand` token.
 * @cssprop [--lr-flow-node-running-border=var(--lr-color-brand)] - Border color of the card while
 *   `status="running"`. Independent from `--lr-flow-node-selected-border` so a consumer can retint
 *   just one of the two states without the other following along.
 * @cssprop [--lr-flow-node-running-glow=var(--lr-color-brand-quiet)] - Box-shadow color of the
 *   running-state ring around the card, and the pulse keyframes' peak color.
 * @cssprop [--lr-flow-node-status-color=var(--lr-color-border-strong)] - Status-dot color when no
 *   execution status is set.
 * @cssprop [--lr-flow-node-status-pending-color=var(--lr-color-border-strong)] - Pending status-dot color.
 * @cssprop [--lr-flow-node-status-running-color=var(--lr-color-brand)] - Running status-dot color.
 * @cssprop [--lr-flow-node-status-success-color=var(--lr-color-success)] - Success status-dot color.
 * @cssprop [--lr-flow-node-status-error-color=var(--lr-color-danger)] - Error status-dot color.
 * @cssprop [--lr-flow-node-status-denied-color=var(--lr-color-warning)] - Denied status-dot color.
 * @cssprop [--lr-flow-node-progress-track-color=var(--lr-color-border)] - Determinate progress
 *   track color.
 * @cssprop [--lr-flow-node-progress-fill-color=var(--lr-color-brand)] - Determinate progress fill
 *   color, independent from the track and other brand-colored states.
 * @status stable
 * @since 4.0.0
 */
export class LyraFlowNode extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    flowInputHandle: LYRA_DEFAULT_flowInputHandle,
    flowOutputHandle: LYRA_DEFAULT_flowOutputHandle,
    flowStatusWithDetail: LYRA_DEFAULT_flowStatusWithDetail,
    flowStatusWithDuration: LYRA_DEFAULT_flowStatusWithDuration,
    progress: LYRA_DEFAULT_progress,
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** This card's identity inside `lr-flow-canvas`, matched against a `nodes` entry's `id`. It
   *  reflects because the canvas adopts light-DOM children by reading the `node-id` *attribute*: a
   *  property-only `card.nodeId = 'fetch'` used to leave the card unslotted, rendering nowhere and
   *  warning that it matched no node. The empty default stays absent from the DOM rather than
   *  serializing as `node-id=""`, which the canvas would have to skip anyway. */
  @property({ attribute: 'node-id', reflect: true, converter: omittedEmptyStringConverter })
  nodeId = '';
  @property() heading = '';
  @property({ reflect: true }) status: FlowRunStatus | null = null;
  @property({ type: Number }) progress: number | null = null;
  @property({ attribute: 'status-detail' }) statusDetail = '';
  @property({ type: Number, attribute: 'duration-ms' }) durationMs: number | null = null;
  @property({ type: Boolean, reflect: true }) selected = false;
  /** Tighter card padding and row gap, for the dense canvases and palette previews these cards
   *  usually render in -- same convention as `lr-source-card`'s `compact`. Defaults to `false`,
   *  i.e. the full card padding. Purely a density knob: the border, background and shadow stay, as
   *  do the `selected` and `status="running"` treatments. */
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ attribute: false }) inputs: FlowHandle[] = DEFAULT_INPUTS;
  @property({ attribute: false }) outputs: FlowHandle[] = DEFAULT_OUTPUTS;
  /** Additive: which physical edge handles render on, mirroring the canvas's own `orientation` when
   *  this card is canvas-adopted; a standalone card defaults to `"horizontal"`. */
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';

  @state() private hasHeaderSlot = false;
  @state() private pulsesRing = false;
  private browserStateSeeded = false;

  private sampleHeaderSlotPresence(): void {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const renderedSlot = renderRoot?.querySelector<HTMLSlotElement>('slot[name="header"]');
    if (renderedSlot) {
      this.hasHeaderSlot = renderedSlot.assignedElements({ flatten: true }).length > 0;
      return;
    }
    const children = (this as unknown as { children?: HTMLCollection }).children;
    this.hasHeaderSlot = Array.from(children ?? []).some((element) => element.getAttribute('slot') === 'header');
  }

  private shouldPulseRing(): boolean {
    const ownerWindow = this.ownerDocument?.defaultView;
    return this.status === 'running' && !!ownerWindow && !prefersReducedMotion(ownerWindow);
  }

  private sampleBrowserState(): void {
    this.sampleHeaderSlotPresence();
    this.pulsesRing = this.shouldPulseRing();
    this.browserStateSeeded = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      // A reconnect may follow detached light-DOM mutation or adoption into an owner whose motion
      // preference differs, without any reactive property changing to schedule willUpdate().
      this.sampleBrowserState();
    } else {
      // A server renderer cannot inspect light DOM or a motion preference. During hydration defer
      // both browser-only answers until the first server-equivalent render has completed.
      this.seedFirstRenderState(() => this.sampleBrowserState());
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // On a browser-only mount connectedCallback() seeds synchronously, so resample here to include
    // same-task property/child writes made after connection but before the first render. A
    // hydrating mount leaves this false until its server-equivalent first update has completed.
    if (this.hasUpdated || this.browserStateSeeded) this.sampleBrowserState();
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.hasHeaderSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /** `progress` normalized to a finite `[0, 100]` percentage, or `null` -- `null`/`undefined` and a
   *  non-finite raw value (e.g. a stray `NaN` push from a decoration) both mean "no determinate
   *  progress bar," matching this property's own "omitted from render entirely when unset"
   *  contract, rather than rendering a bar at a literal `NaN%` inline-size. A finite out-of-range
   *  value clamps into `[0, 100]` instead of over/under-filling the bar -- same shape as
   *  `tool-call-chip`'s/`thinking-panel`'s own `safeDurationMs` getter. */
  private get safeProgress(): number | null {
    return this.progress != null && Number.isFinite(this.progress) ? finiteRange(this.progress, 0, 0, 100) : null;
  }

  /** `durationMs` normalized to a finite, non-negative value, or `null` -- same "omitted when
   *  unset/non-finite" contract and clamp-to-`0` shape as `safeProgress` above (and as
   *  `tool-call-chip`'s/`thinking-panel`'s own `safeDurationMs` getters); this is a purely
   *  displayed value here (formatted by `formattedDuration()`), never fed to a timer. */
  private get safeDurationMs(): number | null {
    return this.durationMs != null && Number.isFinite(this.durationMs) ? finiteRange(this.durationMs, 0, 0) : null;
  }

  private statusLabel(): string {
    switch (this.status) {
      case 'pending':
        return this.localize('statusPending');
      case 'running':
        return this.localize('statusRunning');
      case 'success':
        return this.localize('statusSuccess');
      case 'error':
        return this.localize('statusError');
      case 'denied':
        return this.localize('statusDenied');
      default:
        return '';
    }
  }

  private handleTemplate(kind: 'input' | 'output', handle: FlowHandle): TemplateResult {
    const label =
      handle.label ??
      this.localize(kind === 'input' ? 'flowInputHandle' : 'flowOutputHandle', undefined, { id: handle.id });
    return html`<span
      part="handle handle-${kind}"
      class="handle"
      data-handle-id=${handle.id}
      data-handle-kind=${kind}
      aria-hidden="true"
      title=${label}
    ></span>`;
  }

  override render(): TemplateResult {
    const clampedProgress = this.safeProgress;
    return html`<div part="base">
      <div class="handles handles-input">${this.inputs.map((h) => this.handleTemplate('input', h))}</div>
      <div part="card" class="card" ?data-pulse=${this.pulsesRing}>
        <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
        ${this.hasHeaderSlot
          ? nothing
          : html`<div part="header">
              <slot name="icon" part="icon"></slot>
              <span part="heading">${this.heading}</span>
            </div>`}
        ${this.status
          ? html`<div part="status" data-status=${this.status}>
              <span class="status-dot"></span>${this.statusText()}
            </div>`
          : nothing}
        ${clampedProgress != null
          ? html`<div
              part="progress"
              role="progressbar"
              aria-label=${this.localize('progress')}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow=${clampedProgress}
            >
              <div class="progress-fill" style="inline-size:${clampedProgress}%"></div>
            </div>`
          : nothing}
        <div part="body"><slot></slot></div>
        <div part="toolbar"><slot name="toolbar"></slot></div>
      </div>
      <div class="handles handles-output">${this.outputs.map((h) => this.handleTemplate('output', h))}</div>
    </div>`;
  }

  private formattedDuration(): string {
    const durationMs = this.safeDurationMs;
    if (durationMs == null) return '';
    const formatter = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 1,
    });
    return durationMs < 1000
      ? this.localize('durationMilliseconds', undefined, {
          value: formatter.format(Math.round(durationMs)),
        })
      : this.localize('durationSeconds', undefined, {
          value: formatter.format(Math.round(durationMs / 100) / 10),
        });
  }

  private statusText(): string {
    const label = this.statusLabel();
    const duration = this.formattedDuration();
    const withDuration = duration
      ? this.localize('flowStatusWithDuration', undefined, {
          status: label,
          duration,
        })
      : label;
    return this.statusDetail
      ? this.localize('flowStatusWithDetail', undefined, {
          status: withDuration,
          detail: this.statusDetail,
        })
      : withDuration;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-flow-node': LyraFlowNode;
  }
}
