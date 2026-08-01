import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { styles } from './split-panel.styles.js';

const DEFAULT_POSITION = 50;
const DEFAULT_SNAP_THRESHOLD = 12;
const KEYBOARD_STEP_PERCENT = 1;
const MAX_SNAP_TOKENS = 256;
const POSITION_EPSILON = 0.000_1;

export type SplitPanelOrientation = 'horizontal' | 'vertical';
export type SplitPanelPrimary = 'start' | 'end';

export interface SplitPanelSnapFunctionOptions {
  /** Proposed position in pixels, measured from the primary panel's edge. */
  pos: number;
  /** Split-panel size in pixels along its resize axis. */
  size: number;
  /** The configured snap threshold in pixels. */
  snapThreshold: number;
}

export type SplitPanelSnapFunction = (options: SplitPanelSnapFunctionOptions) => number;
/** Compatibility name used by existing split-panel integrations. */
export type SnapFunction = SplitPanelSnapFunction;

export interface LyraSplitPanelEventMap {
  /** Emitted whenever a pointer or keyboard interaction repositions the divider. */
  'lr-reposition': CustomEvent<undefined>;
}

interface DragState {
  pointerId: number;
  startCoordinate: number;
  startPrimaryPixels: number;
}

function nearlyEqual(left: number | undefined, right: number | undefined): boolean {
  if (left === right) return true;
  if (left == null || right == null) return false;
  return Math.abs(left - right) <= POSITION_EPSILON;
}

/**
 * `<lr-split-panel>` — an accessible, draggable two-pane layout.
 *
 * `position` and `positionInPixels` are measured from the selected `primary`
 * panel's edge. Without a primary panel, `start` is the reference and its
 * percentage is preserved when the component resizes. Selecting `start` or
 * `end` instead preserves that panel's pixel size.
 *
 * @customElement lr-split-panel
 * @slot start - Content in the logical start pane.
 * @slot end - Content in the logical end pane.
 * @slot divider - Optional content rendered inside the draggable divider.
 * @event lr-reposition - Emitted after a pointer or keyboard interaction moves the divider.
 * @csspart base - The component's layout wrapper.
 * @csspart split-panel - Compatibility alias on the layout wrapper.
 * @csspart panel - Shared part on both pane wrappers.
 * @csspart start - The logical start pane.
 * @csspart end - The logical end pane.
 * @csspart divider - The draggable separator.
 * @cssprop [--divider-width=4px] - Visible divider thickness.
 * @cssprop [--divider-hit-area=12px] - Requested divider hit area; Lyra's minimum hit-area token remains the floor.
 * @cssprop [--min=0] - Minimum size of the primary pane, or the start pane when `primary` is unset.
 * @cssprop [--max=100%] - Maximum size of the primary pane, or the start pane when `primary` is unset.
 * @cssprop [--lr-split-panel-divider-width=var(--divider-width)] - Lyra-prefixed divider-width alias.
 * @cssprop [--lr-split-panel-divider-hit-area=var(--divider-hit-area)] - Lyra-prefixed hit-area alias.
 * @cssprop [--lr-split-panel-min=var(--min)] - Lyra-prefixed minimum-size alias.
 * @cssprop [--lr-split-panel-max=var(--max)] - Lyra-prefixed maximum-size alias.
 */
export class LyraSplitPanel extends LyraElement<LyraSplitPanelEventMap> {
  static override styles = [LyraElement.styles, styles];

  private _startPosition = DEFAULT_POSITION;
  private _primary?: SplitPanelPrimary;
  private _snapThreshold = DEFAULT_SNAP_THRESHOLD;
  private availableSize = 0;
  private pendingPositionInPixels?: number;
  private preservedPrimaryPixels?: number;
  private resizeObserver?: ResizeObserver;
  private resizeView?: Window;
  private drag?: DragState;
  private dragView?: Window;

  @query('[part~="base"]') private baseElement?: HTMLElement;
  @query('[part~="divider"]') private dividerElement?: HTMLElement;
  @query('.constraint-min') private minProbe?: HTMLElement;
  @query('.constraint-max') private maxProbe?: HTMLElement;

  /** Divider position as a percentage from the primary panel's edge. */
  @property({ type: Number, reflect: true })
  get position(): number {
    const start = finiteRange(this._startPosition, DEFAULT_POSITION, 0, 100);
    return this.primary === 'end' ? 100 - start : start;
  }
  set position(value: number) {
    const oldPosition = this.position;
    const oldPixels = this.positionInPixels;
    const next = finiteRange(value, DEFAULT_POSITION, 0, 100);
    this.pendingPositionInPixels = undefined;

    if (this.availableSize > 0) {
      this.applyPrimaryPixels((next / 100) * this.availableSize, false, oldPosition, oldPixels);
      return;
    }

    this._startPosition = this.primary === 'end' ? 100 - next : next;
    this.preservedPrimaryPixels = undefined;
    this.requestSynchronizedUpdate(oldPosition, oldPixels);
  }

  /** Divider position in pixels from the primary panel's edge. */
  @property({ type: Number, attribute: 'position-in-pixels' })
  get positionInPixels(): number | undefined {
    if (this.pendingPositionInPixels != null) return this.pendingPositionInPixels;
    if (this.availableSize <= 0) return undefined;
    return (this.position / 100) * this.availableSize;
  }
  set positionInPixels(value: number | undefined | null) {
    const oldPosition = this.position;
    const oldPixels = this.positionInPixels;

    if (value == null) {
      this.pendingPositionInPixels = undefined;
      this.preservedPrimaryPixels = this.availableSize > 0 ? this.positionInPixels : undefined;
      this.requestSynchronizedUpdate(oldPosition, oldPixels);
      return;
    }

    const fallback = this.positionInPixels ?? (DEFAULT_POSITION / 100) * this.availableSize;
    const next = finiteRange(value, fallback, 0, this.availableSize > 0 ? this.availableSize : Number.MAX_VALUE);
    if (this.availableSize > 0) {
      this.applyPrimaryPixels(next, false, oldPosition, oldPixels);
      return;
    }

    this.pendingPositionInPixels = next;
    this.preservedPrimaryPixels = next;
    this.requestSynchronizedUpdate(oldPosition, oldPixels);
  }

  /** Layout axis. Horizontal places panes at logical start and end. */
  @property({ reflect: true }) orientation: SplitPanelOrientation = 'horizontal';

  /** Boolean compatibility alias for `orientation="vertical"`. */
  @property({ type: Boolean, reflect: true }) vertical = false;

  /** Prevents pointer and keyboard repositioning. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Pane whose pixel size remains fixed while the host resizes. */
  @property()
  get primary(): SplitPanelPrimary | undefined {
    return this._primary;
  }
  set primary(value: SplitPanelPrimary | undefined | null) {
    const next = value === 'start' || value === 'end' ? value : undefined;
    if (next === this._primary) return;
    const oldPrimary = this._primary;
    const oldPosition = this.position;
    const oldPixels = this.positionInPixels;
    this._primary = next;
    this.preservedPrimaryPixels = this.availableSize > 0 ? this.positionInPixels : undefined;
    this.requestUpdate('primary', oldPrimary);
    this.requestSynchronizedUpdate(oldPosition, oldPixels);
  }

  /** Space-separated pixel/percent snap points, `repeat(...)`, or a snap callback. */
  @property() snap: string | SplitPanelSnapFunction = '';

  /** Maximum distance in pixels at which string snap points take effect. */
  @property({ type: Number, attribute: 'snap-threshold' })
  get snapThreshold(): number {
    return this._snapThreshold;
  }
  set snapThreshold(value: number) {
    const old = this._snapThreshold;
    this._snapThreshold = finiteRange(value, DEFAULT_SNAP_THRESHOLD, 0, Number.MAX_VALUE);
    this.requestUpdate('snapThreshold', old);
  }

  private get effectiveOrientation(): SplitPanelOrientation {
    return this.vertical || this.orientation === 'vertical' ? 'vertical' : 'horizontal';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        this.observeSize();
        this.measureAndSynchronize(false);
      });
    }
  }

  override disconnectedCallback(): void {
    this.stopDragging();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeView?.removeEventListener('resize', this.onWindowResize);
    this.resizeView = undefined;
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    this.measureAndSynchronize(true);
    this.observeSize();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('orientation') || changed.has('vertical')) {
      this.measureAndSynchronize(false);
    }
  }

  private requestSynchronizedUpdate(oldPosition: number, oldPixels: number | undefined): void {
    if (!nearlyEqual(oldPosition, this.position)) this.requestUpdate('position', oldPosition);
    if (!nearlyEqual(oldPixels, this.positionInPixels)) {
      this.requestUpdate('positionInPixels', oldPixels);
    }
  }

  private axisSize(element: Element | undefined): number {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const measured = this.effectiveOrientation === 'vertical' ? rect.height : rect.width;
    return finiteRange(measured, 0, 0, Number.MAX_VALUE);
  }

  private constraintBounds(): { min: number; max: number } {
    const size = this.availableSize;
    const min = finiteRange(this.axisSize(this.minProbe), 0, 0, size);
    const rawMax = this.axisSize(this.maxProbe);
    const max = finiteRange(rawMax > 0 ? rawMax : size, size, min, size);
    return { min, max };
  }

  private applyPrimaryPixels(
    requestedPixels: number,
    useSnap: boolean,
    oldPosition = this.position,
    oldPixels = this.positionInPixels,
  ): boolean {
    const size = this.availableSize;
    if (size <= 0) {
      this.pendingPositionInPixels = finiteRange(requestedPixels, 0, 0, Number.MAX_VALUE);
      this.preservedPrimaryPixels = this.pendingPositionInPixels;
      this.requestSynchronizedUpdate(oldPosition, oldPixels);
      return false;
    }

    const proposed = finiteRange(requestedPixels, oldPixels ?? (DEFAULT_POSITION / 100) * size, 0, size);
    const snapped = useSnap ? this.applySnap(proposed, size) : proposed;
    const { min, max } = this.constraintBounds();
    const primaryPixels = finiteRange(snapped, proposed, min, max);
    const primaryPercent = (primaryPixels / size) * 100;
    this._startPosition = this.primary === 'end' ? 100 - primaryPercent : primaryPercent;
    this.pendingPositionInPixels = undefined;
    this.preservedPrimaryPixels = primaryPixels;
    this.requestSynchronizedUpdate(oldPosition, oldPixels);
    return !nearlyEqual(oldPosition, this.position) || !nearlyEqual(oldPixels, this.positionInPixels);
  }

  private measureAndSynchronize(initial: boolean): void {
    const nextSize = this.axisSize(this.baseElement);
    if (nextSize <= 0) return;
    const oldPosition = this.position;
    const oldPixels = this.positionInPixels;
    const pending = this.pendingPositionInPixels;
    const preserved = this.preservedPrimaryPixels;
    const sizeChanged = !nearlyEqual(this.availableSize, nextSize);
    this.availableSize = nextSize;

    if (pending != null) {
      this.applyPrimaryPixels(pending, false, oldPosition, oldPixels);
    } else if (!initial && sizeChanged && this.primary && preserved != null) {
      this.applyPrimaryPixels(preserved, false, oldPosition, oldPixels);
    } else {
      this.applyPrimaryPixels((this.position / 100) * nextSize, false, oldPosition, oldPixels);
    }
  }

  private observeSize(): void {
    if (this.resizeObserver || this.resizeView || !this.isConnected) return;
    const view = this.ownerDocument.defaultView;
    const ResizeObserverConstructor = view?.ResizeObserver;
    if (ResizeObserverConstructor) {
      this.resizeObserver = new ResizeObserverConstructor(() => this.measureAndSynchronize(false));
      if (this.baseElement) this.resizeObserver.observe(this.baseElement);
      return;
    }
    if (view) {
      this.resizeView = view;
      view.addEventListener('resize', this.onWindowResize);
    }
  }

  private readonly onWindowResize = (): void => {
    this.measureAndSynchronize(false);
  };

  private resolveSnapLength(value: string, size: number): number | undefined {
    const match = /^((?:\d+(?:\.\d+)?|\.\d+))(px|%)$/i.exec(value.trim());
    if (!match) return undefined;
    const amount = finiteNumber(Number.parseFloat(match[1]!), Number.NaN);
    if (!Number.isFinite(amount) || amount < 0) return undefined;
    return match[2]!.toLowerCase() === '%' ? (amount / 100) * size : amount;
  }

  private applySnap(position: number, size: number): number {
    const threshold = finiteRange(this.snapThreshold, DEFAULT_SNAP_THRESHOLD, 0, Number.MAX_VALUE);
    if (typeof this.snap === 'function') {
      try {
        return finiteRange(this.snap({ pos: position, size, snapThreshold: threshold }), position, 0, size);
      } catch {
        return position;
      }
    }

    const tokens = this.snap.match(
      /repeat\(\s*(?:\d+(?:\.\d+)?|\.\d+)(?:px|%)\s*\)|(?:\d+(?:\.\d+)?|\.\d+)(?:px|%)/gi,
    );
    if (!tokens?.length) return position;

    let nearest = position;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const token of tokens.slice(0, MAX_SNAP_TOKENS)) {
      const repeated = token.toLowerCase().startsWith('repeat(');
      const rawLength = repeated ? token.slice(token.indexOf('(') + 1, token.lastIndexOf(')')) : token;
      const point = this.resolveSnapLength(rawLength, size);
      if (point == null || point < 0) continue;

      const candidates = repeated
        ? [Math.floor(position / point) * point, Math.round(position / point) * point, Math.ceil(position / point) * point]
        : [point];
      for (const candidate of candidates) {
        if (!Number.isFinite(candidate) || candidate < 0 || candidate > size) continue;
        const distance = Math.abs(position - candidate);
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
    }
    return nearestDistance <= threshold ? nearest : position;
  }

  private pointerCoordinate(event: PointerEvent): number {
    return this.effectiveOrientation === 'vertical' ? event.clientY : event.clientX;
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.disabled || this.drag || event.button !== 0) return;
    const primaryPixels = this.positionInPixels;
    if (primaryPixels == null || this.availableSize <= 0) return;
    event.preventDefault();
    this.drag = {
      pointerId: event.pointerId,
      startCoordinate: this.pointerCoordinate(event),
      startPrimaryPixels: primaryPixels,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events and older engines can reject capture; the window listeners below
      // still keep the gesture coherent until up/cancel.
    }
    const view = this.ownerDocument.defaultView;
    this.dragView = view ?? undefined;
    view?.addEventListener('pointermove', this.onPointerMove);
    view?.addEventListener('pointerup', this.onPointerEnd);
    view?.addEventListener('pointercancel', this.onPointerEnd);
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId || this.disabled) return;
    let delta = this.pointerCoordinate(event) - drag.startCoordinate;
    if (this.effectiveOrientation === 'horizontal' && this.effectiveDirection === 'rtl') delta *= -1;
    if (this.primary === 'end') delta *= -1;
    const changed = this.applyPrimaryPixels(drag.startPrimaryPixels + delta, true);
    if (changed) this.emit('lr-reposition');
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.stopDragging();
  };

  private onLostPointerCapture(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.stopDragging();
  }

  private stopDragging(): void {
    const pointerId = this.drag?.pointerId;
    this.drag = undefined;
    this.dragView?.removeEventListener('pointermove', this.onPointerMove);
    this.dragView?.removeEventListener('pointerup', this.onPointerEnd);
    this.dragView?.removeEventListener('pointercancel', this.onPointerEnd);
    this.dragView = undefined;
    if (pointerId != null && this.dividerElement?.hasPointerCapture(pointerId)) {
      try {
        this.dividerElement.releasePointerCapture(pointerId);
      } catch {
        // Capture can already have been released by a detach or platform-level cancellation.
      }
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.disabled || this.availableSize <= 0) return;
    const current = this.positionInPixels;
    if (current == null) return;

    let next: number | undefined;
    const { min, max } = this.constraintBounds();
    if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    else {
      let physicalDirection = 0;
      if (this.effectiveOrientation === 'vertical') {
        if (event.key === 'ArrowDown') physicalDirection = 1;
        else if (event.key === 'ArrowUp') physicalDirection = -1;
      } else if (event.key === 'ArrowRight') {
        physicalDirection = this.effectiveDirection === 'rtl' ? -1 : 1;
      } else if (event.key === 'ArrowLeft') {
        physicalDirection = this.effectiveDirection === 'rtl' ? 1 : -1;
      }
      if (physicalDirection !== 0) {
        const primaryDirection = this.primary === 'end' ? -physicalDirection : physicalDirection;
        next = current + (primaryDirection * KEYBOARD_STEP_PERCENT * this.availableSize) / 100;
      }
    }

    if (next == null) return;
    event.preventDefault();
    if (this.applyPrimaryPixels(next, false)) this.emit('lr-reposition');
  }

  private get separatorLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    if (hostLabel !== null) return hostLabel;
    const number = getNumberFormat(this.effectiveLocale);
    return this.localize('resizeDivider', undefined, {
      a: number.format(1),
      b: number.format(2),
    });
  }

  private get ariaBounds(): { min: number; max: number } {
    if (this.availableSize <= 0) return { min: 0, max: 100 };
    const bounds = this.constraintBounds();
    return {
      min: (bounds.min / this.availableSize) * 100,
      max: (bounds.max / this.availableSize) * 100,
    };
  }

  override render(): TemplateResult {
    const orientation = this.effectiveOrientation;
    const startPosition = finiteRange(this._startPosition, DEFAULT_POSITION, 0, 100);
    const ariaBounds = this.ariaBounds;
    return html`
      <div
        part="base split-panel"
        data-orientation=${orientation}
        data-primary=${this.primary ?? 'start'}
        style=${`--lr-split-panel-start-position: ${startPosition}%`}
      >
        <div part="start panel"><slot name="start"></slot></div>
        <div
          part="divider"
          role="separator"
          aria-label=${this.separatorLabel}
          aria-orientation=${orientation === 'vertical' ? 'horizontal' : 'vertical'}
          aria-valuenow=${String(Math.round(this.position))}
          aria-valuemin=${String(Math.round(ariaBounds.min))}
          aria-valuemax=${String(Math.round(ariaBounds.max))}
          aria-disabled=${this.disabled ? 'true' : 'false'}
          tabindex=${this.disabled ? '-1' : '0'}
          @pointerdown=${this.onPointerDown}
          @lostpointercapture=${this.onLostPointerCapture}
          @keydown=${this.onKeyDown}
        ><slot name="divider"></slot></div>
        <div part="end panel"><slot name="end"></slot></div>
        <div class="constraint-box" aria-hidden="true">
          <div class="constraint-min"></div>
          <div class="constraint-max"></div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-split-panel': LyraSplitPanel;
  }
}
