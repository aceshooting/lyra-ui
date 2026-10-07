import { html, nothing, svg, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { isBarredFromValidation } from '../../../internal/form-associated.js';
import { AnchoredValidityController } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  withStaticValidityCheck,
} from '../../../internal/invalid-event-alias.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { dispatchNativeEvent } from '../../../internal/native-event-relay.js';
import { omittedEmptyStringConverter } from '../../../internal/converters.js';
import { styles } from './signature-pad.styles.js';
import { SIGNATURE_PAD_MAX_STROKES, SIGNATURE_PAD_MAX_POINTS } from './signature-pad-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_signaturePad, LYRA_DEFAULT_signaturePadEmpty, LYRA_DEFAULT_signaturePadInstructions, LYRA_DEFAULT_signaturePadLabel, LYRA_DEFAULT_signaturePadPenDown, LYRA_DEFAULT_signaturePadPenUp, LYRA_DEFAULT_signaturePadSigned } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export { SIGNATURE_PAD_MAX_STROKES, SIGNATURE_PAD_MAX_POINTS } from './signature-pad-limits.js';
installFormControlLabelSupport();

/** One stroke: its `[x, y]` points, each coordinate a fraction (0–1) of the pad's width or height. */
export type SignatureStroke = ReadonlyArray<readonly [number, number]>;

export interface LyraSignaturePadEventMap {
  change: Event;
  'lr-change': CustomEvent<null>;
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
  const strokes: SignatureStroke[] = [];
  for (const raw of Array.isArray(input) ? input : []) {
    if (strokes.length === SIGNATURE_PAD_MAX_STROKES) break;
    const points: Point[] = [];
    for (const point of Array.isArray(raw) ? raw : []) {
      if (points.length === SIGNATURE_PAD_MAX_POINTS) break;
      const [x, y] = Array.isArray(point) ? point : [];
      if (Number.isFinite(x) && Number.isFinite(y)) points.push(at(x, y));
    }
    if (points.length) strokes.push(Object.freeze(points));
  }
  return Object.freeze(strokes);
}

/** A polyline ending on a zero-length segment, so a single point still draws a round dot. */
function pathData(stroke: SignatureStroke): string {
  const points = stroke.map(([x, y]) => `${x} ${y}`);
  return `M${points.join('L')}L${points[points.length - 1]}`;
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
 * @customElement lr-signature-pad
 * @event change - Native event fired when the user finishes a stroke or clears the pad.
 * @event lr-change - Fired with every `change`. Programmatic changes fire neither.
 * @event lr-invalid - The pad failed a validity check. Cancelable: `preventDefault()` also cancels the
 * native `invalid` event behind it.
 * @slot label - Rich label content, after the `label` text.
 * @slot hint - Rich hint content, after the `hint` text.
 * @slot error - Rich error content, after the `errorText` text.
 * @csspart form-control - Wrapper around the label, pad, error and hint.
 * @csspart form-control-label - The visible label.
 * @csspart base - Wrapper around the surface and the clear button.
 * @csspart surface - The focusable drawing surface.
 * @csspart cursor - The keyboard pen position, shown while the surface has keyboard focus.
 * @csspart clear-button - The clear button.
 * @csspart error - The error text.
 * @csspart hint - The hint text.
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
 * @since unreleased
 */
export class LyraSignaturePad extends LyraElement<LyraSignaturePadEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    signaturePad: LYRA_DEFAULT_signaturePad,
    signaturePadEmpty: LYRA_DEFAULT_signaturePadEmpty,
    signaturePadInstructions: LYRA_DEFAULT_signaturePadInstructions,
    signaturePadLabel: LYRA_DEFAULT_signaturePadLabel,
    signaturePadPenDown: LYRA_DEFAULT_signaturePadPenDown,
    signaturePadPenUp: LYRA_DEFAULT_signaturePadPenUp,
    signaturePadSigned: LYRA_DEFAULT_signaturePadSigned,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];
  static override properties = {
    name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    strokes: { attribute: false, noAccessor: true },
  };

  /** Visible label, before the `label` slot. */
  @property() label = '';
  /** Hint text, before the `hint` slot. */
  @property() hint = '';
  /** Error text, before the `error` slot. */
  @property({ attribute: 'error-text' }) errorText = '';

  @state() private penDown = false;
  @state() private cursor: Point = at(0.5, 0.5);

  private readonly internals = attachInternalsSafely(this);
  private readonly validityController = new AnchoredValidityController(this, this.internals, () => this.surface);
  private readonly slots = new SlotPresenceController(this);
  private _name = '';
  private _required = false;
  private _disabled = false;
  private fieldsetDisabled = false;
  private hasInteracted = false;
  private _strokes = EMPTY;
  private dataUrl?: string;
  private active?: Point[];
  private pointerId?: number;
  private rect?: DOMRect;
  /** Last measured width-to-height ratio of the surface. */
  private ratio = 3;
  private sink?: AnnouncementSink;

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
   * non-finite points are dropped, coordinates are clamped to 0–1, and at most
   * `SIGNATURE_PAD_MAX_STROKES` strokes of `SIGNATURE_PAD_MAX_POINTS` points are kept. Assigning the
   * current array is a no-op, and assignments fire no events.
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

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }

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
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cancelStroke();
    this.sink?.release();
    this.sink = undefined;
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
      missing ? this.localize('fieldRequired') : '',
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

  private exportPng(): string {
    const box = this.surface?.getBoundingClientRect();
    if (box?.width && box.height) this.ratio = box.width / box.height;
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

  private begin(point: Point): boolean {
    if (this._strokes.length >= SIGNATURE_PAD_MAX_STROKES) return false;
    this.active = [point];
    this.paintActive();
    return true;
  }

  private extend(point: Point): void {
    const stroke = this.active;
    const last = stroke?.[stroke.length - 1];
    if (!stroke || !last || stroke.length >= SIGNATURE_PAD_MAX_POINTS) return;
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_DISTANCE) return;
    stroke.push(point);
    this.paintActive();
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
    this.paintActive();
  }

  /** Paints the stroke in progress directly, so drawing never re-renders the pad. */
  private paintActive(): void {
    const path = this.renderRoot?.querySelector('.active');
    if (this.active) path?.setAttribute('d', pathData(this.active));
    else path?.removeAttribute('d');
  }

  private userChange(): void {
    this.markInteracted();
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change');
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.inactive || this.active || !event.isPrimary || event.button !== 0) return;
    const surface = event.currentTarget as HTMLElement;
    const rect = (this.rect = surface.getBoundingClientRect());
    if (!rect.width || !rect.height || !this.begin(this.point(event))) return;
    this.pointerId = event.pointerId;
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer has nothing to capture; its own end event still commits.
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) this.extend(this.point(event));
  }

  private onPointerEnd(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) this.commit();
  }

  private point({ clientX, clientY }: PointerEvent): Point {
    const { left, top, width, height } = this.rect!;
    return at((clientX - left) / width, (clientY - top) / height);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.inactive || event.altKey || event.ctrlKey || event.metaKey) return;
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
      this.togglePen();
    } else {
      return;
    }
    event.preventDefault();
  }

  private togglePen(): void {
    if (this.penDown) {
      this.sink?.announce(this.localize('signaturePadPenUp'));
      this.commit();
    } else if (!this.active && this.begin(this.cursor)) {
      this.penDown = true;
      this.sink?.announce(this.localize('signaturePadPenDown'));
    }
  }

  private onFocus(): void {
    // Mounted before the first key press: a live region must exist before its text arrives.
    this.sink ??= acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
  }

  private onBlur(): void {
    if (this.penDown) this.commit();
    this.markInteracted();
  }

  private onClear(): void {
    this.applyStrokes(EMPTY);
    this.userChange();
    this.surface?.focus();
  }

  override render(): TemplateResult {
    const hasLabel = !!this.label || this.slots.has('label');
    const hasHint = !!this.hint || this.slots.has('hint');
    const hasError = !!this.errorText || this.slots.has('error');
    const hostLabel = this.getAttribute('aria-label');
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
            aria-labelledby=${hostLabel === null && hasLabel ? 'label' : nothing}
            aria-describedby=${[hasError && 'error', hasHint && 'hint', 'instructions', 'status'].filter(Boolean).join(' ')}
            aria-disabled=${this.inactive ? 'true' : 'false'}
            aria-invalid=${this.hasInteracted && !this.internals.validity.valid ? 'true' : 'false'}
            @pointerdown=${this.onPointerDown}
            @pointermove=${this.onPointerMove}
            @pointerup=${this.onPointerEnd}
            @pointercancel=${this.onPointerEnd}
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
          <button part="clear-button" type="button" ?disabled=${this.inactive || !count} @click=${this.onClear}>${this.localize('clear')}</button>
        </div>
        <div id="error" part="error" ?hidden=${!hasError}>${this.errorText}<slot name="error"></slot></div>
        <div id="hint" part="hint" ?hidden=${!hasHint}>${this.hint}<slot name="hint"></slot></div>
        <span id="instructions" hidden>${this.localize('signaturePadInstructions')}</span>
        <span id="status" hidden>${count
          ? this.localize('signaturePadSigned', undefined, { count })
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
