import { html, type ComplexAttributeConverter, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { styles } from './split-panel.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_resizeDivider } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const DEFAULT_POSITION = 50;
const DEFAULT_SNAP_THRESHOLD = 12;
const KEYBOARD_STEP_PERCENT = 1;
const MAX_SNAP_TOKENS = 256;
const POSITION_EPSILON = 0.000_1;

export type SplitPanelOrientation = 'horizontal' | 'vertical';
export type SplitPanelPrimary = 'start' | 'end';

export interface SnapFunctionParams {
  /** Proposed position in pixels, measured from the primary panel's edge. */
  pos: number;
  /** Split-panel size in pixels along its resize axis. */
  size: number;
  /** The configured snap threshold in pixels. */
  snapThreshold: number;
}

export type SnapFunction = (options: SnapFunctionParams) => number;
/** Component-qualified alias of `SnapFunction`, for consumers that prefer the longer name. The
 *  parameter object keeps its single canonical name, `SnapFunctionParams`. */
export type SplitPanelSnapFunction = SnapFunction;

/** A proposed user-driven divider position, normalized after constraints and snapping. */
export interface SplitPanelRepositionDetail {
  /** Position as a percentage from the selected primary pane's edge. */
  position: number;
  /** The same position in pixels from the selected primary pane's edge. */
  positionInPixels: number;
}

const snapConverter: ComplexAttributeConverter<string | SnapFunction | undefined> = {
  fromAttribute(value): string {
    return value ?? '';
  },
  toAttribute(value): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
  },
};

export interface LyraSplitPanelEventMap {
  /** Emitted before a pointer or keyboard interaction repositions the divider. */
  'lr-reposition-request': CustomEvent<SplitPanelRepositionDetail>;
  /** Emitted whenever a pointer or keyboard interaction repositions the divider. */
  'lr-reposition': CustomEvent<undefined>;
}

interface DragState {
  pointerId: number;
  startCoordinate: number;
  startPrimaryPixels: number;
}

interface DividerSourceSnapshot {
  inert: string | null;
  appliedInert: string | null;
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
 * @slot divider - Optional decorative content rendered inside the draggable divider. Assigned
 *   content is inert, so the separator remains the sole resize control.
 * @event lr-reposition-request - A cancelable proposed divider position from a pointer drag or
 *   keyboard interaction. Call `preventDefault()` to keep `position` unchanged. Not fired when a
 *   consumer sets `position` or `positionInPixels` directly. `detail: SplitPanelRepositionDetail`.
 * @event lr-reposition - Non-cancelable post-commit notification after a pointer or keyboard
 *   interaction moves the divider. Not fired when a consumer sets `position` or
 *   `positionInPixels` directly.
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
 * @status stable
 * @since 8.0.0
 */
export class LyraSplitPanel extends LyraElement<LyraSplitPanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    resizeDivider: LYRA_DEFAULT_resizeDivider,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _startPosition = DEFAULT_POSITION;
  private _orientation: SplitPanelOrientation = 'horizontal';
  private _primary?: SplitPanelPrimary;
  private _snapThreshold = DEFAULT_SNAP_THRESHOLD;
  private availableSize = 0;
  private pendingPositionInPixels?: number;
  private preservedPrimaryPixels?: number;
  private resizeObserver?: ResizeObserver;
  private resizeView?: Window;
  private drag?: DragState;
  private dragView?: Window;
  private readonly dividerSourceSnapshots = new Map<Element, DividerSourceSnapshot>();
  private dividerSourceObserver?: MutationObserver;
  private dividerSourceObserverDocument?: Document;
  private dividerSourceObserverGeneration = 0;

  @query('[part~="base"]') private baseElement?: HTMLElement;
  @query('[part~="divider"]') private dividerElement?: HTMLElement;
  @query('slot[name="divider"]') private dividerSlot?: HTMLSlotElement;
  @query('.constraint-min') private minProbe?: HTMLElement;
  @query('.constraint-max') private maxProbe?: HTMLElement;

  /** Divider position as a percentage from the primary panel's edge.
   * @default 50 */
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
    const layoutSize = this.measuredLayoutSize();

    if (layoutSize > 0) {
      this.availableSize = layoutSize;
      this.applyPrimaryPixels((next / 100) * layoutSize, false, oldPosition, oldPixels);
      return;
    }

    this._startPosition = this.primary === 'end' ? 100 - next : next;
    this.preservedPrimaryPixels = undefined;
    this.requestSynchronizedUpdate(oldPosition, oldPixels);
  }

  /** Divider position in pixels from the primary panel's edge. */
  @property({ type: Number, attribute: 'position-in-pixels' })
  get positionInPixels(): number {
    if (this.pendingPositionInPixels != null) return this.pendingPositionInPixels;
    if (this.availableSize <= 0) return 0;
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
    const layoutSize = this.measuredLayoutSize();
    const next = finiteRange(value, fallback, 0, layoutSize > 0 ? layoutSize : Number.MAX_VALUE);
    if (layoutSize > 0) {
      this.availableSize = layoutSize;
      this.applyPrimaryPixels(next, false, oldPosition, oldPixels);
      return;
    }

    this.pendingPositionInPixels = next;
    this.preservedPrimaryPixels = next;
    this.requestSynchronizedUpdate(oldPosition, oldPixels);
  }

  /** Layout axis. Horizontal places panes at logical start and end.
   * @default 'horizontal' */
  @property({ reflect: true })
  get orientation(): SplitPanelOrientation {
    return this._orientation;
  }
  set orientation(value: SplitPanelOrientation) {
    const next = value === 'vertical' ? 'vertical' : 'horizontal';
    if (next === this._orientation) return;
    const old = this._orientation;
    const oldVertical = this.vertical;
    this._orientation = next;
    this.requestUpdate('orientation', old);
    this.requestUpdate('vertical', oldVertical);
  }

  /** Boolean compatibility alias for `orientation="vertical"`.
   * @default false */
  @property({ type: Boolean, reflect: true })
  get vertical(): boolean {
    return this.orientation === 'vertical';
  }
  set vertical(value: boolean) {
    this.orientation = value ? 'vertical' : 'horizontal';
  }

  /** Prevents pointer and keyboard repositioning. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Pane whose pixel size remains fixed while the host resizes. */
  @property({ reflect: true })
  get primary(): SplitPanelPrimary | undefined {
    return this._primary;
  }
  set primary(value: SplitPanelPrimary | undefined | null) {
    const next = value === 'start' || value === 'end' ? value : undefined;
    if (next === this._primary) return;
    this.stopDragging();
    const oldPrimary = this._primary;
    const oldPosition = this.position;
    const oldPixels = this.positionInPixels;
    const layoutSize = this.measuredLayoutSize();
    const referencePixels =
      layoutSize > 0 && !oldPrimary ? (oldPosition / 100) * layoutSize : oldPixels;
    this._primary = next;
    // `position` is public state measured from whichever edge `primary` selects. Switching that
    // reference must not silently rewrite the assigned number; instead, move the physical divider
    // so the same percentage/pixel value is now measured from the newly selected edge. This also
    // makes declarative attributes order-independent (`position="25" primary="end"` and the
    // reversed spelling both place the divider 25% from the end).
    if (layoutSize > 0) {
      this.availableSize = layoutSize;
      this.applyPrimaryPixels(referencePixels, false, oldPosition, oldPixels);
    } else {
      this._startPosition = next === 'end' ? 100 - oldPosition : oldPosition;
      this.preservedPrimaryPixels = this.pendingPositionInPixels ?? oldPixels;
    }
    this.requestUpdate('primary', oldPrimary);
  }

  private _snap: string | SnapFunction = '';
  /** Space-separated pixel/percent snap points, `repeat(...)`, or a snap callback. Assigning the
   * Web Awesome `undefined` spelling restores the inert empty-string read default. */
  @property({ reflect: true, converter: snapConverter })
  get snap(): string | SnapFunction {
    return this._snap;
  }
  set snap(value: string | SnapFunction | undefined) {
    const old = this._snap;
    this._snap = value ?? '';
    this.requestUpdate('snap', old);
  }

  /** Maximum distance in pixels at which string snap points take effect.
   * @default 12 */
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
    return this.orientation;
  }

  private measuredLayoutSize(): number {
    return this.isConnected ? this.axisSize(this.baseElement) : 0;
  }

  override connectedCallback(): void {
    const authoredOrientation = this.getAttribute('orientation');
    super.connectedCallback();
    // The canonical string form wins when both APIs appear in initial markup, independent of the
    // browser's custom-element attribute-upgrade order.
    if (authoredOrientation !== null) {
      this.orientation = authoredOrientation === 'vertical' ? 'vertical' : 'horizontal';
    }
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        this.syncDividerSources();
        this.observeSize();
        this.measureAndSynchronize(false);
      });
    }
  }

  override disconnectedCallback(): void {
    this.stopDragging();
    this.resetDividerSourceObserver();
    this.restoreDividerSources();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeView?.removeEventListener('resize', this.onWindowResize);
    this.resizeView = undefined;
    super.disconnectedCallback();
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.syncDividerSources();
    this.measureAndSynchronize(true);
    this.observeSize();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('disabled') && this.disabled) this.stopDragging();
    if (changed.has('orientation') || changed.has('vertical')) {
      this.stopDragging();
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
    // Zero is a valid authored maximum (`--max: 0` collapses the controlled pane), so only a
    // genuinely absent probe falls back to the full axis size.
    const rawMax = this.maxProbe ? this.axisSize(this.maxProbe) : size;
    const max = finiteRange(rawMax, size, min, size);
    return { min, max };
  }

  /** Resolves a user or property-supplied position without mutating public
   *  state. The interaction request event needs this finalized (snapped and
   *  constrained) value before any assignment occurs. */
  private resolvePrimaryPixels(
    requestedPixels: number,
    useSnap: boolean,
    fallbackPixels: number | undefined,
  ): number {
    const size = this.availableSize;
    const proposed = finiteRange(
      requestedPixels,
      fallbackPixels ?? (DEFAULT_POSITION / 100) * size,
      0,
      size,
    );
    const snapped = useSnap ? this.applySnap(proposed, size) : proposed;
    const { min, max } = this.constraintBounds();
    return finiteRange(snapped, proposed, min, max);
  }

  private applyPrimaryPixels(
    requestedPixels: number,
    useSnap: boolean,
    oldPosition = this.position,
    oldPixels = this.positionInPixels,
    scheduleUpdate = true,
    resolvedPrimaryPixels?: number,
  ): boolean {
    const size = this.availableSize;
    if (size <= 0) {
      this.pendingPositionInPixels = finiteRange(requestedPixels, 0, 0, Number.MAX_VALUE);
      this.preservedPrimaryPixels = this.pendingPositionInPixels;
      if (scheduleUpdate) this.requestSynchronizedUpdate(oldPosition, oldPixels);
      return false;
    }

    const primaryPixels =
      resolvedPrimaryPixels ?? this.resolvePrimaryPixels(requestedPixels, useSnap, oldPixels);
    const primaryPercent = (primaryPixels / size) * 100;
    this._startPosition = this.primary === 'end' ? 100 - primaryPercent : primaryPercent;
    this.pendingPositionInPixels = undefined;
    this.preservedPrimaryPixels = primaryPixels;
    if (scheduleUpdate) this.requestSynchronizedUpdate(oldPosition, oldPixels);
    return (
      !nearlyEqual(oldPosition, this.position) || !nearlyEqual(oldPixels, this.positionInPixels)
    );
  }

  /** Proposes a finalized user-driven position before committing it. Direct
   *  property assignments deliberately continue through applyPrimaryPixels()
   *  without either interaction event. */
  private requestReposition(requestedPixels: number, useSnap: boolean): boolean {
    if (this.availableSize <= 0) return false;
    const oldPosition = this.position;
    const oldPixels = this.positionInPixels;
    const primaryPixels = this.resolvePrimaryPixels(requestedPixels, useSnap, oldPixels);
    const primaryPercent = (primaryPixels / this.availableSize) * 100;
    const position = this.primary === 'end' ? 100 - primaryPercent : primaryPercent;
    if (nearlyEqual(oldPosition, position) && nearlyEqual(oldPixels, primaryPixels)) return false;

    const request = this.emit(
      'lr-reposition-request',
      { position, positionInPixels: primaryPixels },
      { cancelable: true },
    );
    if (request.defaultPrevented) return false;
    if (
      !this.applyPrimaryPixels(
        requestedPixels,
        useSnap,
        oldPosition,
        oldPixels,
        true,
        primaryPixels,
      )
    ) {
      return false;
    }
    this.emit('lr-reposition');
    return true;
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
      this.applyPrimaryPixels(pending, false, oldPosition, oldPixels, false);
    } else if (!initial && sizeChanged && this.primary && preserved != null) {
      this.applyPrimaryPixels(preserved, false, oldPosition, oldPixels, false);
    } else {
      this.applyPrimaryPixels(
        (this.position / 100) * nextSize,
        false,
        oldPosition,
        oldPixels,
        false,
      );
    }
    // Measurements run from firstUpdated/updated/ResizeObserver. Scheduling another Lit update
    // from those lifecycle phases produces a dev-mode warning and an avoidable second render, so
    // synchronize the three measurement-owned DOM values directly. Property assignments and user
    // interactions still take the normal reactive update path.
    this.synchronizeMeasuredDom();
  }

  private synchronizeMeasuredDom(): void {
    const startPosition = finiteRange(this._startPosition, DEFAULT_POSITION, 0, 100);
    this.baseElement?.style.setProperty('--_lr-split-panel-start-position', `${startPosition}%`);
    if (this.dividerElement) {
      const bounds = this.ariaBounds;
      this.dividerElement.setAttribute('aria-valuenow', String(Math.round(this.position)));
      this.dividerElement.setAttribute('aria-valuemin', String(Math.round(bounds.min)));
      this.dividerElement.setAttribute('aria-valuemax', String(Math.round(bounds.max)));
    }
    const reflectedPosition = String(this.position);
    if (this.getAttribute('position') !== reflectedPosition) {
      this.setAttribute('position', reflectedPosition);
    }
  }

  private observeSize(): void {
    if (this.resizeObserver || this.resizeView || !this.isConnected) return;
    const view = this.ownerDocument.defaultView;
    const ResizeObserverConstructor = view?.ResizeObserver;
    if (ResizeObserverConstructor) {
      this.resizeObserver = new ResizeObserverConstructor(() => this.measureAndSynchronize(false));
      if (this.baseElement) this.resizeObserver.observe(this.baseElement);
      // `--min`/`--max` may change through the cascade without changing the host's own box. The
      // hidden probes turn those CSS values into observable allocation changes so constraints are
      // re-applied immediately even when no host resize accompanies the theme/style update.
      if (this.minProbe) this.resizeObserver.observe(this.minProbe);
      if (this.maxProbe) this.resizeObserver.observe(this.maxProbe);
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

  private snapshotDividerSource(source: Element): DividerSourceSnapshot {
    const inert = source.getAttribute('inert');
    return { inert, appliedInert: inert };
  }

  private adoptDividerSourceInert(source: Element, snapshot: DividerSourceSnapshot): void {
    const current = source.getAttribute('inert');
    if (current !== snapshot.appliedInert) snapshot.inert = current;
  }

  private makeDividerSourceInert(source: Element, snapshot: DividerSourceSnapshot): void {
    if (!source.hasAttribute('inert')) source.setAttribute('inert', '');
    snapshot.appliedInert = source.getAttribute('inert');
  }

  private restoreDividerSource(source: Element, snapshot: DividerSourceSnapshot): void {
    this.adoptDividerSourceInert(source, snapshot);
    if (snapshot.inert === null) source.removeAttribute('inert');
    else source.setAttribute('inert', snapshot.inert);
  }

  private restoreDividerSources(): void {
    for (const [source, snapshot] of this.dividerSourceSnapshots) {
      this.restoreDividerSource(source, snapshot);
    }
    this.dividerSourceSnapshots.clear();
  }

  private resetDividerSourceObserver(): void {
    this.dividerSourceObserverGeneration += 1;
    this.dividerSourceObserver?.disconnect();
    this.dividerSourceObserver = undefined;
    this.dividerSourceObserverDocument = undefined;
  }

  private observeDividerSources(): void {
    this.resetDividerSourceObserver();
    const MutationObserverConstructor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverConstructor || !this.isConnected || this.dividerSourceSnapshots.size === 0) {
      return;
    }
    const generation = this.dividerSourceObserverGeneration;
    const observer = new MutationObserverConstructor((records) => {
      if (
        this.dividerSourceObserver !== observer ||
        this.dividerSourceObserverDocument !== this.ownerDocument ||
        this.dividerSourceObserverGeneration !== generation ||
        !this.isConnected
      ) {
        return;
      }
      if (records.some((record) => this.dividerSourceSnapshots.has(record.target as Element))) {
        this.syncDividerSources();
      }
    });
    this.dividerSourceObserver = observer;
    this.dividerSourceObserverDocument = this.ownerDocument;
    for (const source of this.dividerSourceSnapshots.keys()) {
      observer.observe(source, { attributes: true, attributeFilter: ['inert'] });
    }
  }

  private syncDividerSources(): void {
    const assigned = new Set(this.dividerSlot?.assignedElements({ flatten: true }) ?? []);
    for (const [source, snapshot] of this.dividerSourceSnapshots) {
      this.adoptDividerSourceInert(source, snapshot);
      if (!assigned.has(source)) {
        this.restoreDividerSource(source, snapshot);
        this.dividerSourceSnapshots.delete(source);
      }
    }
    for (const source of assigned) {
      const snapshot = this.dividerSourceSnapshots.get(source) ?? this.snapshotDividerSource(source);
      this.dividerSourceSnapshots.set(source, snapshot);
      this.adoptDividerSourceInert(source, snapshot);
      this.makeDividerSourceInert(source, snapshot);
    }
    this.observeDividerSources();
  }

  private readonly onDividerSlotChange = (): void => {
    this.syncDividerSources();
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
        return finiteRange(
          this.snap({ pos: position, size, snapThreshold: threshold }),
          position,
          0,
          size,
        );
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
      const rawLength = repeated
        ? token.slice(token.indexOf('(') + 1, token.lastIndexOf(')'))
        : token;
      const point = this.resolveSnapLength(rawLength, size);
      if (point == null || point < 0) continue;

      const candidates = repeated
        ? [
            Math.floor(position / point) * point,
            Math.round(position / point) * point,
            Math.ceil(position / point) * point,
          ]
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
    this.dividerElement?.setAttribute('data-dragging', '');
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
    if (this.effectiveOrientation === 'horizontal' && this.effectiveDirection === 'rtl')
      delta *= -1;
    if (this.primary === 'end') delta *= -1;
    this.requestReposition(drag.startPrimaryPixels + delta, true);
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
    this.dividerElement?.removeAttribute('data-dragging');
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
    this.requestReposition(next, false);
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
        style=${`--_lr-split-panel-start-position: ${startPosition}%`}
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
        >
          <slot name="divider" @slotchange=${this.onDividerSlotChange}></slot>
        </div>
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
