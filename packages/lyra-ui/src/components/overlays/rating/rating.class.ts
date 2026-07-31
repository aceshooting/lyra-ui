import { html, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { styles } from './rating.styles.js';

const DEFAULT_MAX = 5;
/** No real-world star rating needs more stars than this; caps an untrusted `max` so it can't turn
 *  `render()`'s `Array.from({ length: count })` below into an unbounded allocation. */
const MAX_STARS = 100;
const DEFAULT_PRECISION = 1;
/** A `<= 0` precision would divide-by-zero when `setValue` snaps `next / precision`; keep it
 *  comfortably positive and no coarser than the star count itself. */
const MIN_PRECISION = 0.01;

/** Visual density of the rendered symbols. */
export type LyraRatingSize = 'xs' | 's' | 'm' | 'l' | 'xl';

/** Which point of a hover gesture an `lr-hover` event describes. */
export type LyraRatingHoverPhase = 'start' | 'move' | 'end';

/**
 * Renders one symbol. Called twice per position — once for the empty backdrop (`selected` false)
 * and once for the overlay clipped to that position's filled fraction (`selected` true) — so a
 * fractional `precision` still renders a partial fill. Return any Lit-renderable value; a plain
 * string renders as text, never as markup.
 */
export type LyraRatingSymbolRenderer = (value: number, selected: boolean) => unknown;

export interface LyraRatingEventMap {
  'lr-change': CustomEvent<{ value: number }>;
  'lr-hover': CustomEvent<{ phase: LyraRatingHoverPhase; value: number }>;
}

// A five-point star, sharing internal/icons.ts's 24x24 viewBox / 1em sizing
// contract so it reads as part of the same visual language, without adding a
// rating-only shape to that shared module. Rendered as two stacked copies per
// star -- a `currentColor`-stroked outline (the empty backdrop) and a
// `currentColor`-filled solid clipped to the filled fraction -- so a
// fractional `precision` (e.g. `0.5`) can render a partial fill instead of
// only ever snapping to the nearest whole star.
const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';
function starOutline(): SVGTemplateResult {
  return svg`<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points=${STAR_POINTS}></polygon></svg>`;
}
function starSolid(): SVGTemplateResult {
  return svg`<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" focusable="false"><polygon points=${STAR_POINTS}></polygon></svg>`;
}

/**
 * `<lr-rating>` — a keyboard-accessible star rating control. Pointer position within a symbol is
 * mirrored under RTL and snapped to `precision`, matching keyboard/value fractional selection.
 *
 * Form-associated through `ElementInternals` directly rather than through the shared
 * `FormAssociated` mixin: this control's `value` is a number, not the plain string that mixin's
 * contract assumes, so the mixin would force every consumer through string round-tripping for what
 * is natively a numeric score. The submitted entry is the clamped value stringified (`"0"` while
 * unrated), and `required` reports `valueMissing` until a rating above zero is set. As with a
 * native `<input>`, the `value` *content attribute* is the reset default — `form.reset()` restores
 * it — while the `value` IDL property is the live score and is deliberately not reflected.
 *
 * Deliberately no label/hint/error chrome: `label` here is an accessible-name override, not visible
 * label text. A rating is a row of symbols with no field frame of its own, so a consumer wanting a
 * labeled field wraps this element in their own layout, exactly as `<lr-slider>` does.
 *
 * @customElement lr-rating
 * @event lr-change - The rating changed. `detail: { value }`.
 * @event lr-hover - The pointer entered, moved across, or left the symbols while the rating is
 * settable. `detail: { phase, value }`, where `value` is the rating that committing the current
 * pointer position would produce — enough to render a live description of what is being hovered.
 * @method focus - Forwards focus to the internal slider control.
 * @method blur - Forwards blur to the internal slider control.
 * @method click - Forwards activation to the internal slider control.
 * @method checkValidity - Returns whether the control currently satisfies its constraints.
 * @method reportValidity - Same as `checkValidity`, additionally showing the browser's validation UI.
 * @csspart base - The slider-like rating control.
 * @csspart star - Each visual symbol.
 * @csspart star-fill - The filled overlay inside each symbol, clipped to that
 * symbol's filled fraction (0%, a partial percentage under a fractional
 * `precision`, or 100%).
 * @cssprop [--lr-rating-fill=var(--lr-color-warning)] - Filled-symbol color.
 * @cssprop [--lr-rating-empty-color=var(--lr-color-border)] - Unfilled-symbol color, retained during
 * hover preview.
 * @cssprop [--lr-rating-size=var(--lr-font-size-xl)] - Symbol size. Each `size` step rewrites it;
 * the `m` default reproduces the treatment this component had before `size` existed.
 */
export class LyraRating extends LyraElement<LyraRatingEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  // Hand-written accessors (rather than plain reactive fields) so the host attribute, the
  // ElementInternals submission value, and validity are all recomputed synchronously on
  // assignment: native form APIs (`new FormData(form)`, `form.checkValidity()`) read them in the
  // same tick, long before Lit's async update cycle would have run.
  static override properties = {
    value: { type: Number, noAccessor: true },
    max: { type: Number, reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property({ type: Number }) precision = 1;
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Accessible-name override taken straight from a host `aria-label` attribute. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Accessible name for the whole control, used when the host carries no `aria-label`. Not
   *  rendered as visible text — a rating has no field frame of its own. */
  @property() label = '';
  /** Visual density; rewrites `--lr-rating-size`. */
  @property({ reflect: true }) size: LyraRatingSize = 'm';
  /** Renders a consumer-supplied symbol per position instead of the built-in star. */
  @property({ attribute: false }) getSymbol?: LyraRatingSymbolRenderer;

  /** The rating the current pointer position would commit; only meaningful while `hovering`. */
  @state() private hoverValue = 0;
  @state() private hovering = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private _value = 0;
  private _max = DEFAULT_MAX;
  private _name = '';
  private _required = false;
  private _disabled = false;
  private _fieldsetDisabled = false;
  private _defaultValue = 0;

  constructor() {
    super();
    // Shares the mixin's attach-or-degrade helper so both paths handle a missing *and* a throwing
    // `attachInternals()` (SSR/test DOMs, partial polyfills) without breaking construction.
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.internals.setFormValue('0');
  }

  /** The current rating. Clamped to `[0, max]` wherever it is read; the raw assignment is kept so
   *  a value set before `max` arrives from markup isn't silently truncated. */
  get value(): number {
    return this._value;
  }
  set value(next: number) {
    const old = this._value;
    this._value = typeof next === 'number' ? next : Number(next);
    this.syncFormValue();
    this.requestUpdate('value', old);
  }

  /** The highest rating to show, i.e. the number of symbols rendered. */
  get max(): number {
    return this._max;
  }
  set max(next: number) {
    const old = this._max;
    this._max = typeof next === 'number' ? next : Number(next);
    // `safeValue` is clamped to `max`, so the submitted entry changes with it.
    this.syncFormValue();
    this.requestUpdate('max', old);
  }

  /** Submitted as the name half of the form-data name/value pair. */
  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.requestUpdate('name', old);
  }

  /** Blocks form submission until a rating above zero is set. */
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

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    // Reflected synchronously: `:disabled` and constraint-validation barring are both driven by
    // the live host attribute, which same-tick form APIs read.
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.resetHover();
    this.requestUpdate('disabled', old);
  }

  /** Whether the control is disabled explicitly or by an ancestor `<fieldset disabled>`. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="base"]') ?? null;
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  formResetCallback(): void {
    this.resetHover();
    this.value = this._defaultValue;
  }

  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    this.value = typeof state === 'string' ? finiteNumber(Number(state), 0) : 0;
  }

  formDisabledCallback(fieldsetDisabled: boolean): void {
    this._fieldsetDisabled = fieldsetDisabled;
    if (fieldsetDisabled) this.resetHover();
    this.requestUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // `required`/`value` may already have arrived from markup; reflect validity from the start
    // rather than only after the first assignment.
    this.updateValidity();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // A disconnect/reconnect cycle (drag-drop reparenting, list virtualization) never delivers the
    // pointerleave that would otherwise end the gesture, so the preview would resume frozen.
    this.resetHover();
  }

  override attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    super.attributeChangedCallback(name, old, val);
    // Native `<input>` semantics: the *content attribute* is the reset default, and only markup or
    // an explicit `setAttribute` updates it. Using the property setter to capture "whichever
    // assignment happened first" would instead make a user's very first rating permanent.
    // Stored raw, not clamped: HTML applies observed attributes in source order, so `value="8"`
    // parsed before `max="10"` would otherwise be frozen at the default max's ceiling.
    if (name === 'value') this._defaultValue = this._value;
  }

  /** `max`, normalized to a finite non-negative integer count and capped at `MAX_STARS` so an
   *  untrusted attribute can't blow up the star count rendered below. */
  private get safeMax(): number {
    return finiteCount(this.max, DEFAULT_MAX, MAX_STARS);
  }

  /** `value`, normalized to a finite number clamped to `[0, safeMax]`. */
  private get safeValue(): number {
    return finiteRange(this.value, 0, 0, this.safeMax);
  }

  /** `precision`, normalized to a finite number and kept within `[MIN_PRECISION, safeMax]` — a
   *  `<= 0` precision would otherwise divide-by-zero in `setValue`'s `next / precision` step. */
  private get safePrecision(): number {
    const precision = finiteRange(this.precision, DEFAULT_PRECISION, MIN_PRECISION, this.safeMax);
    return precision > 0 ? precision : DEFAULT_PRECISION;
  }

  /** Whether pointer/keyboard input can currently change the value. */
  private get interactive(): boolean {
    return !this.effectiveDisabled && !this.readonly;
  }

  private syncFormValue(): void {
    // Runs from property setters, which can fire before the constructor body under a DOM shim.
    if (!this.internals) return;
    this.internals.setFormValue(String(this.safeValue));
    this.updateValidity();
  }

  private updateValidity(): void {
    if (!this.validityController) return;
    if (this.required && this.safeValue <= 0) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('fieldRequired'));
    } else {
      this.validityController.setValidity({});
    }
  }

  private setValue(next: number): void {
    if (!this.interactive) return;
    const precision = this.safePrecision;
    const clamped = Math.max(0, Math.min(this.safeMax, Math.round(next / precision) * precision));
    if (clamped === this.value) return;
    this.value = clamped;
    this.emit('lr-change', { value: this.value });
  }

  /**
   * The rating the pointer is currently over, snapped up to `precision`, or `null` when the
   * pointer is between symbols (the gap) rather than on one. Resolved from the symbol's own box
   * rather than the control's, since the symbols are centred inside a hit-area floor that is
   * usually wider than they are.
   */
  private pointerValue(event: MouseEvent): number | null {
    const target = (event.target as HTMLElement | null)?.closest?.('[data-value]') as HTMLElement | null;
    if (!target) return null;
    const star = Number(target.dataset['value']);
    if (!Number.isFinite(star)) return null;
    const rect = target.getBoundingClientRect();
    const precision = this.safePrecision;
    if (rect.width <= 0) return Math.max(0, Math.min(this.safeMax, star));
    const physicalFraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const logicalFraction = this.effectiveDirection === 'rtl' ? 1 - physicalFraction : physicalFraction;
    const rawValue = star - 1 + logicalFraction;
    return Math.max(precision, Math.min(this.safeMax, Math.ceil(rawValue / precision) * precision));
  }

  private onClick = (event: MouseEvent): void => {
    const next = this.pointerValue(event);
    if (next === null) return;
    this.setValue(next);
  };

  private onPointerEnter = (event: PointerEvent): void => {
    if (!this.interactive) return;
    this.hovering = true;
    this.hoverValue = this.pointerValue(event) ?? this.hoverValue;
    this.emit('lr-hover', { phase: 'start', value: this.hoverValue });
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.interactive) return;
    const next = this.pointerValue(event);
    if (next === null) return;
    if (!this.hovering) {
      // A pointer can reach the symbols without a pointerenter the component saw (it re-rendered
      // under a stationary pointer, or the gesture began on a neighbouring element).
      this.hovering = true;
      this.hoverValue = next;
      this.emit('lr-hover', { phase: 'start', value: next });
      return;
    }
    if (next === this.hoverValue) return;
    this.hoverValue = next;
    this.emit('lr-hover', { phase: 'move', value: next });
  };

  /** Ends the gesture on pointerleave and on pointercancel alike — a touch drag taken over by
   *  scrolling, or palm rejection, ends with `pointercancel` and no `pointerleave` at all. */
  private onPointerEnd = (): void => {
    if (!this.hovering) return;
    this.hovering = false;
    this.emit('lr-hover', { phase: 'end', value: this.hoverValue });
  };

  /** Drops the preview without announcing an end phase, for teardown paths the user didn't drive. */
  private resetHover(): void {
    this.hovering = false;
    this.hoverValue = 0;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forwardKey || event.key === 'ArrowUp') { event.preventDefault(); this.setValue(this.safeValue + this.safePrecision); }
    if (event.key === backwardKey || event.key === 'ArrowDown') { event.preventDefault(); this.setValue(this.safeValue - this.safePrecision); }
    if (event.key === 'Home') { event.preventDefault(); this.setValue(0); }
    if (event.key === 'End') { event.preventDefault(); this.setValue(this.safeMax); }
  };

  private get control(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[part="base"]');
  }

  override focus(options?: FocusOptions): void {
    this.control?.focus(options);
  }

  override blur(): void {
    this.control?.blur();
  }

  override click(): void {
    this.control?.click();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // `disabled` can only change through its own setter; the fieldset path goes through
    // `formDisabledCallback`, and `readonly` is a plain reactive property — so a rating that
    // becomes non-settable mid-hover drops its preview here.
    if (changed.has('readonly') && !this.interactive) this.resetHover();
  }

  /** One symbol: the consumer's `getSymbol` when set, otherwise the built-in star. */
  private symbol(star: number, selected: boolean): unknown {
    if (this.getSymbol) return this.getSymbol(star, selected);
    return selected ? starSolid() : starOutline();
  }

  override render(): TemplateResult {
    const safeMax = this.safeMax;
    const safeValue = this.safeValue;
    // The hover preview is never applied to a rating that can't be changed, and is clamped in case
    // `max` shrank below the hovered position while the pointer was still down.
    const displayValue = this.hovering && this.interactive ? Math.min(this.hoverValue, safeMax) : safeValue;
    const count = Math.round(safeMax);
    return html`<div part="base" role="slider" tabindex=${this.effectiveDisabled ? '-1' : '0'}
      aria-label=${this.getAttribute('aria-label') || this.accessibleLabel || this.label || this.localize('rating')}
      aria-valuemin="0" aria-valuemax=${safeMax} aria-valuenow=${safeValue}
      aria-valuetext=${getNumberFormat(this.effectiveLocale).format(safeValue)}
      aria-disabled=${this.effectiveDisabled ? 'true' : 'false'} aria-readonly=${this.readonly ? 'true' : 'false'}
      aria-required=${this.required ? 'true' : 'false'}
      @click=${this.onClick} @keydown=${this.onKeyDown}
      @pointerenter=${this.onPointerEnter} @pointermove=${this.onPointerMove}
      @pointerleave=${this.onPointerEnd} @pointercancel=${this.onPointerEnd}>
      ${Array.from({ length: count }, (_, index) => {
        const star = index + 1;
        const fraction = Math.max(0, Math.min(1, displayValue - index));
        return html`<span part="star" data-value=${star} ?data-filled=${fraction >= 1} aria-hidden="true">
          ${this.symbol(star, false)}
          <span part="star-fill" style=${`inline-size:${fraction * 100}%`}>${this.symbol(star, true)}</span>
        </span>`;
      })}
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-rating': LyraRating; } }
