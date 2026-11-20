import type { LyraLabelDisplay } from '../../../internal/variants.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { formControlSupportingState, renderFormControlHintError } from '../../../internal/form-control-template.js';
import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { LyraAppearance } from '../../../internal/variants.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { projectFrozenRows, readOwnDataValue } from '../../../internal/data-descriptors.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { isBarredFromValidation } from '../../../internal/form-associated.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import { AnchoredValidityController } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  withStaticValidityCheck,
} from '../../../internal/invalid-event-alias.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { capturePointer } from '../../../internal/pointer-capture.js';
import { OwnedResizeObserver } from '../../../internal/owned-observer.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { dispatchNativeEvent } from '../../../internal/native-event-relay.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import { styles } from './signature-pad.styles.js';
import { SIGNATURE_PAD_MAX_STROKES, SIGNATURE_PAD_MAX_POINTS } from './signature-pad-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_signaturePad, LYRA_DEFAULT_signaturePadDrawingLimit, LYRA_DEFAULT_signaturePadEmpty, LYRA_DEFAULT_signaturePadInstructions, LYRA_DEFAULT_signaturePadLabel, LYRA_DEFAULT_signaturePadPenDown, LYRA_DEFAULT_signaturePadPenUp, LYRA_DEFAULT_signaturePadSigned } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export { SIGNATURE_PAD_MAX_STROKES, SIGNATURE_PAD_MAX_POINTS } from './signature-pad-limits.js';
installFormControlLabelSupport();

/** One stroke: its `[x, y]` points, each coordinate a fraction (0–1) of the pad's width or height. */
export type SignatureStroke = ReadonlyArray<readonly [number, number]>;

export interface LyraSignaturePadEventMap {
  change: Event;
  'lr-change': CustomEvent<null>;
  'lr-clear': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
}

type Point = readonly [number, number];

const EMPTY: readonly SignatureStroke[] = Object.freeze([]);
const EXPORT_SIZE = 1024;
const MIN_DISTANCE = 0.002;

/** A frozen point clamped to the pad box at a 1/10 000 resolution. */
const at = (x: number, y: number): Point =>
  Object.freeze([x, y].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4) as [number, number]);

function normalizeStrokes(input: unknown): readonly SignatureStroke[] {
  return projectFrozenRows<SignatureStroke>(input, (raw) => {
    const points = projectFrozenRows<Point>(raw, (point) => {
      if (!Array.isArray(point)) return undefined;
      const x = readOwnDataValue(point, '0');
      const y = readOwnDataValue(point, '1');
      return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
        ? at(x, y) : undefined;
    }, SIGNATURE_PAD_MAX_POINTS, Object.freeze([]));
    return points.length ? points : undefined;
  }, SIGNATURE_PAD_MAX_STROKES, EMPTY);
}

const strokePathData = new WeakMap<SignatureStroke, string>();

/** A polyline ending on a zero-length segment, so a single point still draws a round dot. */
function pathData(stroke: SignatureStroke): string {
  const cached = strokePathData.get(stroke);
  if (cached !== undefined) return cached;
  const points = stroke.map(([x, y]) => `${x} ${y}`);
  const path = `M${points.join('L')}L${points[points.length - 1]}`;
  strokePathData.set(stroke, path);
  return path;
}

/**
 * `<lr-signature-pad>` — a form control that captures a drawn signature with a pointer, touch or the
 * keyboard, and submits it as a PNG data URL. An empty pad submits no form entry.
 *
 * Strokes are stored as fractions of the pad box and drawn as SVG, so resizing, zoom and theme
 * changes need no redraw, and the surface keeps `--lr-signature-pad-aspect-ratio`, so a resize scales
 * the signature uniformly. The surface is one tab stop: the arrow keys move the pen cursor by 1 % of
 * the box (10 % with Shift), Space or Enter lowers and lifts the pen, and Escape lifts it. Arrow keys
 * keep their physical direction in right-to-left documents, because a signature is never mirrored.
 *
 * A pointer release, cancellation or loss of capture commits the drawn portion once. Host
 * `aria-describedby` references precede the focused surface’s error, hint, instructions and status.
 * An empty host aria-label clears the name. Whitespace alone uses the visible label or localized signature name.
 *
 * @customElement lr-signature-pad
 * @event change - Native event fired when the user finishes a stroke or clears the pad.
 * @event lr-change - Fired with every `change`. Programmatic changes fire neither.
 * @event lr-clear - Fired after the change pair when the clear button empties the pad.
 * @event lr-invalid - The pad failed a validity check. Cancelable: `preventDefault()` also cancels the
 * native `invalid` event behind it.
 * @slot label - Rich label content, after the `label` text.
 * @slot hint - Rich hint content, after the `hint` text.
 * @slot error - Rich error content, after the `errorText` text.
 * @csspart form-control - Wrapper around the label, pad, error and hint.
 * @cssprop [--lr-form-control-invalid-border-color] - Shared invalid border color, overridden by a component-specific invalid border.
 * @cssprop [--lr-form-control-label-font-size=var(--lr-font-size-md-sm)] - Font size of the field label.
 * @cssprop [--lr-form-control-label-font-weight=var(--lr-font-weight-semibold)] - Font weight of the field label.
 * @cssprop [--lr-form-control-label-color=inherit] - Text color of the field label.
 * @csspart form-control-label - The visible label.
 * @csspart base - Wrapper around the surface and the clear button.
 * @csspart surface - The focusable drawing surface.
 * @csspart cursor - The keyboard pen position, shown while the surface has keyboard focus.
 * @csspart clear-button - The clear button.
 * @csspart error - The error text.
 * @csspart hint - The hint text.
 * @cssprop [--lr-signature-pad-fill] - Drawing surface background, defaulting to the field appearance.
 * @cssprop [--lr-signature-pad-border-color] - Resting surface border, defaulting to the field appearance.
 * @cssprop [--lr-signature-pad-radius=var(--lr-form-control-radius)] - Drawing surface corner radius.
 * @cssprop [--lr-signature-pad-hover-border-color=var(--lr-color-text-quiet)] - Surface border on hover.
 * @cssprop [--lr-signature-pad-invalid-border-color] - Invalid surface border, overriding the shared invalid border.
 * @cssprop [--lr-signature-pad-clear-hover-bg] - Clear button background on hover.
 * @cssprop [--lr-signature-pad-clear-active-bg] - Clear button background while pressed.
 * @cssprop [--lr-signature-pad-ink=var(--lr-color-text)] - On-screen stroke colour.
 * @cssprop [--lr-signature-pad-stroke-width=var(--lr-border-width-medium)] - On-screen stroke width.
 * @cssprop [--lr-signature-pad-aspect-ratio=3 / 1] - Width-to-height ratio of the surface.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker after the label; `''`
 * suppresses it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker colour.
 * @cssprop [--lr-form-control-required-offset=0] - Space between the label text and the marker.
 * @cssstate required - Matches while `required` is set.
 * @cssstate optional - Matches while `required` is not set.
 * @cssstate valid - Matches while the pad satisfies its constraints.
 * @cssstate invalid - Matches while it does not.
 * @cssstate user-valid - `valid` once the user has drawn, cleared, left the pad or tried to submit.
 * @cssstate user-invalid - `invalid` after that same interaction.
 * @status experimental
 * @since 26.0.0
 */
export class LyraSignaturePad extends LyraElement<LyraSignaturePadEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    signaturePad: LYRA_DEFAULT_signaturePad,
    signaturePadDrawingLimit: LYRA_DEFAULT_signaturePadDrawingLimit,
    signaturePadEmpty: LYRA_DEFAULT_signaturePadEmpty,
    signaturePadInstructions: LYRA_DEFAULT_signaturePadInstructions,
    signaturePadLabel: LYRA_DEFAULT_signaturePadLabel,
    signaturePadPenDown: LYRA_DEFAULT_signaturePadPenDown,
    signaturePadPenUp: LYRA_DEFAULT_signaturePadPenUp,
    signaturePadSigned: LYRA_DEFAULT_signaturePadSigned,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];
  static override properties = {
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    strokes: { attribute: false, noAccessor: true },
  };

  /** Visible label, before the `label` slot. */
  @property() label = '';
  /**
   * Whether the `label` renders on screen. `hidden` keeps the label as the accessible name but
   * removes it visually (compact toolbars, table cells); hint, error and required semantics are
   * unaffected. Reflected so styles and `[label-display]` selectors match.
   * @attr label-display
   */
  @property({ attribute: 'label-display', reflect: true }) labelDisplay: LyraLabelDisplay = 'visible';
  /** Hint text, before the `hint` slot. */
  @property() hint = '';
  /** Error text, before the `error` slot. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Visual treatment of the drawing surface, from the library's shared vocabulary and with the same
   *  meanings as `<lr-input>`'s `appearance`. Each value only swaps the private fill/border pair
   *  behind `--lr-signature-pad-fill`/`--lr-signature-pad-border-color`. */
  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';

  @state() private penDown = false;
  @state() private cursor: Point = at(0.5, 0.5);

  private readonly internals = attachInternalsSafely(this);
  private readonly validityController = new AnchoredValidityController(this, this.internals, () => this.surface);
  private readonly hostDescription = new HostDescriptionController(this, () => this.surface ?? null);
  private readonly slots = new SlotPresenceController(this);
  private _name = '';
  private _required = false;
  private _disabled = false;
  private _readonly = false;
  private fieldsetDisabled = false;
  private hasInteracted = false;
  private _strokes = EMPTY;
  private dataUrl?: string;
  private active?: Point[];
  private activePath: SVGPathElement | null = null;
  private activePathData = '';
  private pointerId?: number;
  private rect?: DOMRect;
  /** Last measured width-to-height ratio of the surface. */
  private ratio = 3;
  /** The ratio the cached PNG was exported at; `undefined` until an export ran. */
  private exportedRatio?: number;
  private readonly surfaceObserver = new OwnedResizeObserver(this, () => this.refreshMeasuredExport());
  private readonly sink = new AnnouncementSinkController(this);

  constructor() {
    super();
    installInvalidEventAlias(this, (init: { cancelable: true }) => this.emit('lr-invalid', null, init));
    installInteractionOnInvalid(this, this.markInteracted);
  }

  /** Submitted as the name of the form entry. */
  get name(): string {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.requestUpdate('name', old);
  }

  /** Makes an empty pad `valueMissing`. */
  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  /**
   * Blocks user drawing and clearing while retaining focus and form submission.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get readonly(): boolean {
    return this._readonly;
  }
  set readonly(value: boolean) {
    const previous = this._readonly;
    this._readonly = Boolean(value);
    if (this._readonly && this.active) this.cancelStroke();
    this.requestUpdate('readonly', previous);
  }

  /** Blocks drawing and clearing and removes the surface from the tab order. */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.syncDisabled();
    this.requestUpdate('disabled', old);
  }

  /**
   * The signature's strokes. Assign saved strokes to restore a signature: the input is copied,
   * non-finite/accessor points are dropped and coordinates are clamped to 0–1. Only the first
   * `SIGNATURE_PAD_MAX_STROKES` stroke positions and `SIGNATURE_PAD_MAX_POINTS` point positions per
   * stroke are inspected through own data descriptors. Assigning the current array is a no-op,
   * and assignments fire no events.
   */
  get strokes(): readonly SignatureStroke[] {
    return this._strokes;
  }
  set strokes(next: readonly SignatureStroke[] | null | undefined) {
    if (next !== this._strokes) this.applyStrokes(normalizeStrokes(next));
  }

  /**
   * Read-only PNG data URL of the signature, `''` while empty: black ink on a transparent background,
   * 1024 px on the long side and the surface's aspect ratio, independent of screen density and theme.
   */
  get value(): string {
    return this._strokes.length ? (this.dataUrl ??= this.exportPng()) : '';
  }

  /** The owning `<form>`, or `null` when there is none. */
  get form(): HTMLFormElement | null {
    return this.internals.form;
  }

  /** The control's `ValidityState`. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** The current validation message, or an empty string when valid. */
  get validationMessage(): string {
    return this.internals.validationMessage;
  }

  /** Removes every stroke without firing events. */
  clear(): void {
    this.applyStrokes(EMPTY);
  }

  checkValidity(): boolean {
    return withStaticValidityCheck(this, () => this.internals.checkValidity());
  }

  reportValidity(): boolean {
    this.markInteracted();
    return this.internals.reportValidity();
  }

  /** Sets, or with `''` clears, a consumer-supplied validation error. */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncStates();
  }

  formResetCallback(): void {
    this.hasInteracted = false;
    this.applyStrokes(EMPTY);
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    let saved: unknown;
    try {
      saved = typeof state === 'string' ? JSON.parse(state) : undefined;
    } catch {
      // A malformed state restores an empty pad.
    }
    this.applyStrokes(normalizeStrokes(saved));
  }

  formDisabledCallback(disabled: boolean): void {
    this.fieldsetDisabled = disabled;
    this.syncDisabled();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    if (this.hasUpdated) this.surfaceObserver.resume();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.activePath = this.renderRoot.querySelector<SVGPathElement>('path.active');
    const surface = this.surface;
    if (surface) this.surfaceObserver.observe(surface);
  }

  override focus(options?: FocusOptions): void {
    if (this.inactive) return;
    this.surface?.focus(options);
  }

  override blur(): void {
    const active = shadowFocusTarget(this);
    if (active && typeof (active as HTMLElement).blur === 'function') (active as HTMLElement).blur();
  }

  /** Focuses the drawing surface, the one tab stop a click on the host would land on. */
  override click(): void {
    this.focus();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.surfaceObserver.disconnect();
    this.cancelStroke();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.sink.adopted();
    this.hostDescription.adopted();
  }

  private get inactive(): boolean {
    return this._disabled || this.fieldsetDisabled;
  }

  private get barred(): boolean {
    return isBarredFromValidation({ disabled: this.inactive }, this.internals);
  }

  private get surface(): HTMLElement | null | undefined {
    return this.renderRoot?.querySelector<HTMLElement>('[part="surface"]');
  }

  private syncDisabled(): void {
    if (this.inactive) this.cancelStroke();
    this.updateValidity();
  }

  private updateValidity(): void {
    const missing = this._required && !this._strokes.length && !this.barred;
    this.validityController.setValidity(
      missing ? { valueMissing: true } : {},
      missing ? () => this.localize('fieldRequired') : '',
    );
    this.syncStates();
  }

  private syncStates(): void {
    syncValidityStates(this.internals, {
      required: this._required,
      hasInteracted: this.hasInteracted,
      barred: this.barred,
    });
    this.requestUpdate();
  }

  private readonly markInteracted = (): void => {
    this.hasInteracted = true;
    this.syncStates();
  };

  private applyStrokes(strokes: readonly SignatureStroke[]): void {
    const old = this._strokes;
    this.cancelStroke();
    this._strokes = strokes;
    this.dataUrl = undefined;
    const { value } = this;
    if (value) this.internals.setFormValue(value, JSON.stringify(strokes));
    else this.internals.setFormValue(null);
    this.updateValidity();
    this.requestUpdate('strokes', old);
  }

  /** A signature restored or assigned before the surface had a layout box was exported at the
   *  fallback ratio; once the surface is measured at another ratio the cached PNG and the form
   *  value are rebuilt so the submitted image matches what the user sees. */
  private refreshMeasuredExport(): void {
    if (this.exportedRatio === undefined || !this._strokes.length) return;
    const box = this.surface?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    if (Math.abs(box.width / box.height - this.exportedRatio) < 1e-3) return;
    this.dataUrl = undefined;
    const { value } = this;
    if (value) this.internals.setFormValue(value, JSON.stringify(this._strokes));
  }

  private exportPng(): string {
    const box = this.surface?.getBoundingClientRect();
    if (box?.width && box.height) this.ratio = box.width / box.height;
    this.exportedRatio = this.ratio;
    const canvas = this.ownerDocument.createElement('canvas');
    const width = (canvas.width = Math.round(EXPORT_SIZE * Math.min(1, this.ratio)));
    const height = (canvas.height = Math.round(EXPORT_SIZE / Math.max(1, this.ratio)));
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.lineWidth = EXPORT_SIZE / 256;
    context.lineCap = context.lineJoin = 'round';
    for (const stroke of this._strokes) {
      context.beginPath();
      for (const [x, y] of stroke) {
        context.lineTo(x * width, y * height);
        if (stroke.length === 1) context.arc(x * width, y * height, context.lineWidth / 2, 0, 2 * Math.PI);
      }
      if (stroke.length === 1) context.fill();
      else context.stroke();
    }
    return canvas.toDataURL();
  }

  private announceDrawingLimit(): void {
    this.sink.announcePolite(this.localize('signaturePadDrawingLimit'));
  }

  private begin(point: Point): boolean {
    if (this._strokes.length >= SIGNATURE_PAD_MAX_STROKES) {
      this.announceDrawingLimit();
      return false;
    }
    this.pointLimitAnnounced = false;
    this.active = [point];
    this.writeActivePath('M', point);
    return true;
  }

  private pointLimitAnnounced = false;

  private extend(point: Point): void {
    const stroke = this.active;
    const last = stroke?.[stroke.length - 1];
    if (!stroke || !last || Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_DISTANCE) return;
    if (stroke.length >= SIGNATURE_PAD_MAX_POINTS) {
      if (!this.pointLimitAnnounced) {
        this.pointLimitAnnounced = true;
        this.announceDrawingLimit();
      }
      return;
    }
    stroke.push(point);
    this.writeActivePath('L', point);
  }

  private commit(): void {
    const stroke = this.active;
    if (!stroke) return this.cancelStroke();
    this.applyStrokes(Object.freeze([...this._strokes, Object.freeze(stroke)]));
    this.userChange();
  }

  private cancelStroke(): void {
    this.active = this.pointerId = undefined;
    this.penDown = false;
    this.activePathData = '';
    this.activePath?.removeAttribute('d');
  }

  private writeActivePath(command: 'M' | 'L', [x, y]: Point): void {
    const point = `${x} ${y}`;
    this.activePathData += `${command}${point}`;
    this.activePath?.setAttribute('d', `${this.activePathData}L${point}`);
  }

  private userChange(): void {
    this.markInteracted();
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change');
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.inactive || this.readonly || this.active || !event.isPrimary || event.button !== 0) return;
    const surface = event.currentTarget as HTMLElement;
    const rect = (this.rect = surface.getBoundingClientRect());
    if (!rect.width || !rect.height || !this.begin(this.point(event))) return;
    this.pointerId = event.pointerId;
    // A synthetic pointer has nothing to capture; its own end event still commits.
    capturePointer(surface, event.pointerId);
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) this.extend(this.point(event));
  }

  private onPointerEnd(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) this.commit();
  }

  private onLostPointerCapture(event: PointerEvent): void {
    // Touch may transfer implicit capture from a descendant to the surface at the start of a stroke.
    if (event.target === event.currentTarget) this.onPointerEnd(event);
  }

  private point({ clientX, clientY }: PointerEvent): Point {
    const { left, top, width, height } = this.rect!;
    return at((clientX - left) / width, (clientY - top) / height);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.inactive || this.readonly || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 0.1 : 0.01;
    const [x, y] = this.cursor;
    const moves: Record<string, [number, number] | undefined> = {
      // policy-allow(rtl-arrow-keys): the drawing surface is physical; a signature never mirrors.
      ArrowLeft: [x - step, y],
      ArrowRight: [x + step, y],
      ArrowUp: [x, y - step],
      ArrowDown: [x, y + step],
    };
    const move = moves[event.key];
    if (move) {
      this.cursor = at(...move);
      if (this.penDown) this.extend(this.cursor);
    } else if (event.key === ' ' || event.key === 'Enter' || (event.key === 'Escape' && this.penDown)) {
      // A held key must not flip the pen at the repeat rate (one-point dots, announcement spam).
      if (!event.repeat) this.togglePen();
    } else {
      return;
    }
    event.preventDefault();
  }

  private togglePen(): void {
    if (this.penDown) {
      this.sink.announcePolite(this.localize('signaturePadPenUp'));
      this.commit();
    } else if (!this.active && this.begin(this.cursor)) {
      this.penDown = true;
      this.sink.announcePolite(this.localize('signaturePadPenDown'));
    }
  }

  private onFocus(): void {
    // Mounted before the first key press: a live region must exist before its text arrives.
    this.sink.current('polite');
  }

  private onBlur(): void {
    if (this.penDown) this.commit();
    this.markInteracted();
  }

  private onClear(): void {
    if (this.inactive || this.readonly || this._strokes.length === 0) return;
    this.applyStrokes(EMPTY);
    this.userChange();
    this.emit('lr-clear');
    this.surface?.focus();
  }

  override render(): TemplateResult {
    const hasLabel = Boolean(normalizeLabel(this.label)) || this.slots.has('label');
    const supporting = {
      presence: { has: (name: string) => name !== 'help-text' && this.slots.has(name) },
      idPrefix: 'signature',
      hint: this.hint,
      errorText: this.errorText,
      extraDescribedBy: ['instructions', 'status'],
    };
    const { hasHint, hasError, describedBy } = formControlSupportingState(supporting);
    const authored = this.getAttribute('aria-label');
    const hostLabel = authored === '' ? '' : normalizeLabel(authored);
    const count = this._strokes.length;
    const [x, y] = this.cursor;
    return html`
      <div part="form-control">
        <div id="label" part="form-control-label" ?hidden=${!hasLabel}>${this.label}<slot name="label"></slot></div>
        <div part="base">
          <div
            id="surface"
            part="surface"
            role="application"
            tabindex=${this.inactive ? nothing : 0}
            aria-roledescription=${this.localize('signaturePad')}
            aria-label=${hostLabel ?? (hasLabel ? nothing : this.localize('signaturePadLabel'))}
            aria-labelledby=${hostLabel === undefined && hasLabel ? 'label' : nothing}
            aria-describedby=${describedBy}
            aria-disabled=${this.inactive ? 'true' : 'false'}
            aria-invalid=${hasError || (this.hasInteracted && !this.internals.validity.valid) ? 'true' : 'false'}
            @pointerdown=${this.onPointerDown}
            @pointermove=${this.onPointerMove}
            @pointerup=${this.onPointerEnd}
            @pointercancel=${this.onPointerEnd}
            @lostpointercapture=${this.onLostPointerCapture}
            @keydown=${this.onKeyDown}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          >
            <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
              ${this._strokes.map((stroke) => svg`<path d=${pathData(stroke)}></path>`)}<path class="active"></path>
            </svg>
            <span
              part="cursor"
              ?data-down=${this.penDown}
              style=${styleMap({ left: `${x * 100}%`, top: `${y * 100}%` })}
            ></span>
          </div>
          <button part="clear-button" type="button" ?disabled=${this.inactive || this.readonly || !count} @click=${this.onClear}>${this.localize('clear')}</button>
        </div>
        ${renderFormControlHintError({ ...supporting, hasHint, hasError })}
        <span id="instructions" hidden>${this.localize('signaturePadInstructions')}</span>
        <span id="status" hidden>${count
          ? this.localize('signaturePadSigned', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(count),
              pluralCount: count,
            })
          : this.localize('signaturePadEmpty')}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-signature-pad': LyraSignaturePad;
  }
}
