import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { isRtl } from '../../../internal/rtl.js';
import {
  decimalPlaces,
  finiteInterpolate,
  finiteNumber,
  finiteRange,
  finiteRatio,
  isSliderKey,
} from '../../../internal/numbers.js';
import type { LyraSize, LyraSizeStep } from '../../../internal/variants.js';
import { styles } from './time-range.styles.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import { activeElementIn } from '../../../internal/active-element.js';

export type TimeRangeHandle = 'start' | 'end';

/** Formats a finite, clamped handle value for `aria-valuetext`; return a nullish value to omit
 *  the attribute for that handle. */
export type TimeRangeValueFormatter = (
  value: number,
  handle: TimeRangeHandle,
) => string | null | undefined;

interface DragState {
  handle: TimeRangeHandle;
  changed: boolean;
  /** `[part="base"]`'s rect and the resolved direction, snapshotted once in
   *  onPointerDown rather than re-read on every pointermove of the same
   *  gesture: getBoundingClientRect()/getComputedStyle() in a window-level
   *  pointermove handler force a synchronous layout/style flush interleaved
   *  with the previous move's own style writes, and neither value changes
   *  from this component's own updates mid-drag (the drag only moves the
   *  handles/fill, never the base's box). Re-measured at every gesture
   *  start, so any between-gesture layout change is always picked up.
   *  Mirrors lr-slider's identical snapshot. */
  rect: DOMRect;
  rtl: boolean;
}

/** PageUp/PageDown move by a larger increment than a single ArrowUp/Down
 *  step, matching the WAI-ARIA APG slider pattern's expected keyboard
 *  interactions (and native `<input type=range>`). */
const PAGE_STEP_MULTIPLIER = 10;

/** Alias of the library-wide {@linkcode LyraSizeStep}; kept as a named export so existing imports
 *  and the generated manifest keep resolving while there is exactly one definition of the ladder. */
export type LyraTimeRangeSize = LyraSizeStep;

/** A single discrete-preset option for the `presets` property. */
export interface TimeRangePreset {
  label: string;
  start: number;
  end: number;
}

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op -- same fix as
 *  `<lr-checkbox>`'s/`<lr-combobox>`'s identical `createInternalsSafely`/`createNoopInternals`
 *  pair. */
function createInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals !== 'function') return createNoopInternals();
  try {
    return host.attachInternals();
  } catch {
    return createNoopInternals();
  }
}

function createNoopInternals(): ElementInternals {
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity: {} as ValidityState,
    validationMessage: '',
    willValidate: false,
    setFormValue(): void {},
    setValidity(): void {},
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
    // A plain `Set<string>` implements every member `CustomStateSet` exposes, so the six validity
    // custom states stay observable (just not CSS-matchable) in an environment with no real
    // `ElementInternals` -- mirrors `<lr-radio>`'s/`<lr-rubric-form>`'s identical stand-ins.
    states: new Set<string>(),
  } as unknown as ElementInternals;
}

export interface LyraTimeRangeEventMap {
  input: Event;
  change: Event;
  'lr-input': CustomEvent<{ start: number; end: number }>;
  'lr-change': CustomEvent<{ start: number; end: number }>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
}
/**
 * `<lr-time-range>` — a two-handle brush/scrubber over a numeric domain.
 * Callers map their own time axis to `[min, max]`; no date logic lives here
 * (matches the no-date-library constraint used elsewhere in this library).
 *
 * Optionally paired with a row of discrete presets (`presets`) — e.g. "Last
 * 7 days" / "Last 30 days" — rendered above the track; picking one is just a
 * shortcut that sets both handles at once, the continuous brush underneath
 * is unaffected and both interaction modes coexist.
 *
 * Form-associated for the `<fieldset disabled>` cascade and for validation, not for a submitted
 * value: it attaches `ElementInternals` (like `<lr-combobox>`'s minimal pattern, rather than the
 * single-string-value `FormAssociated` mixin, which doesn't fit a two-handle range) so that an
 * ancestor `<fieldset disabled>` disables both handles and every preset button through
 * `effectiveDisabled` the same way it would a native `<input>`, without touching the
 * consumer-facing `disabled` property/attribute itself. Unlike `<lr-combobox>`, it never calls
 * `internals.setFormValue()` and has no `name` — the selected range is not included in the owning
 * form's `FormData` on submit; read `start`/`end` directly (e.g. from `lr-change`) instead of
 * relying on native form submission.
 *
 * It has no constraints of its own — every reachable range is a legal one, so `checkValidity()`
 * passes unless a consumer has set an error through `setCustomValidity()`. That method is the
 * whole point of the validity surface here: a range this component cannot know is wrong (an
 * overlapping booking, a window the server rejects) still blocks submission of the form the
 * element sits in.
 *
 * Deliberately no label/hint/error chrome -- `startLabel`/`endLabel` here are per-handle
 * accessible-name overrides, not visible label text, the same carve-out `<lr-slider>` states for
 * its own single-handle `label`; a labeled-field consumer wraps this element in their own layout.
 *
 * @customElement lr-time-range
 * @event input - Native event fired continuously while a user moves either handle.
 * @event change - Native event fired when a handle interaction or preset commits.
 * @event lr-input - Fired continuously while dragging or on each arrow-key press. `detail: { start, end }`.
 * @event lr-change - Fired on release / keyup-commit, or when a preset button is clicked. `detail: { start, end }`.
 * @event focus - Native focus relayed once from either handle.
 * @event blur - Native blur relayed once from either handle.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @csspart base - The time-range wrapper.
 * @csspart track - The complete range track.
 * @csspart range - The selected range.
 * @csspart handle-start - The start handle.
 * @csspart handle-end - The end handle.
 * @csspart presets - The preset controls wrapper.
 * @csspart preset-button - A preset button.
 * @cssstate required - Never matches: this control has no `required` constraint of its own. Kept
 *   so the six-state vocabulary is the same on every form-associated control in the library.
 * @cssstate optional - Always matches — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, i.e. unless a
 *   `setCustomValidity()` error is set.
 * @cssstate invalid - Matches while a `setCustomValidity()` error is set.
 * @cssstate user-valid - `valid`, but only after the user has interacted: moving a handle, picking
 *   a preset, blurring the control, or a `reportValidity()` call (which is what a submit attempt
 *   runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 *   rather than `invalid`: a range the consumer rejected before the user touched anything is
 *   genuinely invalid, but colouring it red on first paint is hostile.
 * @cssprop [--lr-time-range-preset-active-bg=var(--lr-color-brand)] - Background of the active
 *   preset button (`[data-active]`, i.e. the preset whose range matches the current value). Declared
 *   as an inline `var()` fallback (never on `:host`), so setting it on the element or an ancestor
 *   recolors only the active preset without hijacking the library-wide `--lr-color-brand` token.
 * @cssprop [--lr-time-range-preset-active-border-color=var(--lr-color-brand)] - Border color of the
 *   active preset button.
 * @cssprop [--lr-time-range-preset-active-color=var(--lr-color-on-brand)] - Text color of the active
 *   preset button.
 * @cssprop [--lr-time-range-size-scale=1] - Unitless multiplier applied proportionally to the handle,
 *   track, and preset-button dimensions based on the current `size` tier; the drag hit-area is floored
 *   at 24px (WCAG 2.5.8).
 * @cssprop [--lr-time-range-handle-size=14px*scale] - Visible handle diameter.
 * @cssprop [--lr-time-range-hit-size=max(24px,28px*scale)] - Actual drag hit-area diameter;
 *   endpoint handles are inset by half this distance so the hit geometry stays inside the host.
 * @cssprop [--lr-time-range-track-size=4px*scale] - Track and selected-range thickness.
 * @cssprop [--lr-time-range-base-size=1.5rem*scale] - Brush baseline block size.
 * @cssprop [--lr-time-range-preset-gap=var(--lr-space-xs)] - Gap between preset buttons.
 * @cssprop [--lr-time-range-preset-radius=var(--lr-radius)] - Preset button corner radius.
 * @cssprop --lr-time-range-preset-padding - Preset button padding, scaled by `size`.
 * @cssprop --lr-time-range-preset-font-size - Preset button font size, scaled by `size`.
 */
export class LyraTimeRange extends LyraElement<LyraTimeRangeEventMap> {
  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    // Hand-written accessor (see the `get`/`set disabled` pair below)
    // instead of a plain `@property({ reflect: true })`: this element is
    // form-associated, and the browser invokes `formDisabledCallback`
    // synchronously for *this element's own* `disabled` attribute changes
    // too, not only for an ancestor `<fieldset disabled>` toggling. A plain
    // reflecting property defers its attribute write into the async Lit
    // update cycle, so that browser callback would otherwise fire nested
    // *inside* this same element's own in-progress update -- the
    // `requestUpdate()` it triggers (to pick up `_fieldsetDisabled`) then
    // races Lit's own scheduling and can resolve `updateComplete` before the
    // corrected value actually renders. Reflecting the attribute
    // synchronously, right in the setter (mirrors `<lr-combobox>`'s and
    // `FormAssociated`'s identical `disabled` accessor), makes the browser
    // invoke that callback *before* any Lit update even starts, so it never
    // interleaves with one.
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) start = 0;
  @property({ type: Number }) end = 100;
  @property({ type: Number }) step = 1;
  /** Visual size — proportionally scales the handle, track, and preset buttons via a single
   *  multiplier; the drag hit-area never shrinks below 24px (WCAG 2.5.8). Not pixel-matched to
   *  `lr-input`'s row-height scale -- this component's own dimensions aren't on that ladder. The Web Awesome / Shoelace spellings
   *  `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a tag rename with no
   *  attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Accessible name for the start handle, used as its `aria-label`.
   *  Overridable for i18n/custom copy; defaults to the same literal text
   *  this component always rendered before the property existed. */
  @property({ attribute: 'start-label' }) startLabel = 'Range start';
  /** Accessible name for the end handle, used as its `aria-label`.
   *  Overridable for i18n/custom copy; defaults to the same literal text
   *  this component always rendered before the property existed. */
  @property({ attribute: 'end-label' }) endLabel = 'Range end';
  /** Optional human-readable formatter for each handle's `aria-valuetext`. Receives the same
   *  finite, clamped number exposed through `aria-valuenow` plus `'start'`/`'end'`; leaving it
   *  unset preserves the numeric-only slider contract. Return `null`/`undefined` to omit
   *  `aria-valuetext` for a handle. */
  @property({ attribute: false }) valueFormatter?: TimeRangeValueFormatter;
  /**
   * Optional discrete presets rendered as a `[part="presets"]` button row
   * above the track. Purely additive: leaving this empty (the default)
   * renders nothing extra and leaves the continuous brush untouched.
   */
  @property({ attribute: false }) presets: TimeRangePreset[] = [];

  private _disabled = false;
  // Tracked separately from the consumer's own `disabled` -- a fieldset
  // cascade must never mutate that IDL property/attribute itself (mirrors
  // combobox.ts's/slider.ts's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern), only the combined getter below.
  private _fieldsetDisabled = false;

  // Keyed by pointerId rather than a single scalar so two concurrent drags
  // (e.g. a two-finger touch, one per handle) each keep tracking their own
  // handle instead of the second pointerdown hijacking which handle the
  // first pointer's subsequent moves apply to.
  private drags = new Map<number, DragState>();
  private keyboardChanged = false;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Whether the user has acted on this control yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states: a committed handle move, a preset pick, a blur, or a
   *  `reportValidity()` call. A range a consumer has already rejected is genuinely invalid, but
   *  styling it as an error before the user has done anything is hostile, which is the entire
   *  reason the `user-*` pair exists. Not a reactive property: nothing in `render()` reads it. */
  private hasInteracted = false;

  constructor() {
    super();
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () =>
      this[VALIDITY_ANCHOR](),
    );
    // Blur counts as interaction exactly as it does in the `FormAssociated` mixin. `focusout` is
    // the observable signal: native `blur` neither bubbles nor crosses the shadow boundary, so a
    // host-level `blur` listener would never fire for the internal handles. Registered in the
    // constructor, on the host itself, so reconnecting cannot stack duplicates.
    this.addEventListener('focusout', this.markInteracted);
    this.reflectValidityStates();
  }

  private markInteracted = (): void => {
    if (this.hasInteracted) return;
    this.hasInteracted = true;
    this.reflectValidityStates();
  };

  private emitInput(): void {
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', { start: this.start, end: this.end });
  }

  private emitChange(): void {
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { start: this.start, end: this.end });
  }

  private onHandleFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onHandleBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds. `required` is
   *  always `false` here — this control has no such constraint — so it is permanently
   *  `:state(optional)`, which is the honest answer rather than a missing one. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, { required: false, hasInteracted: this.hasInteracted });
  }

  /** @internal The start handle: a real, focusable shadow descendant, so the browser can anchor
   *  its validation bubble on it rather than falling back to the host. */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="handle-start"]') ?? null;
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

  /** Whether the control currently satisfies its constraints — the silent query, so it
   *  deliberately does not count as interaction for the `user-*` custom states. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** `checkValidity()`, plus the browser's own validation UI on failure. */
  reportValidity(): boolean {
    // A submit attempt runs this, and native `:user-invalid` starts matching at exactly that
    // point, so it counts as interaction for the `user-*` custom states.
    this.markInteracted();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the only validation channel this control
   * has, since every reachable range is intrinsically legal (see the class comment). A non-empty
   * `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks submission of the form it sits in, and matches `:state(invalid)`;
   * `''` clears it and republishes the control's own computed validity.
   *
   * The error survives handle moves, preset picks and a form reset, exactly like a native control
   * — only another `setCustomValidity('')` clears it. A consumer re-validating a range on every
   * `lr-input` therefore calls this with the new message (or `''`) each time rather than relying
   * on the movement itself to clear it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`,
   *  whose own `disabled` IDL property/attribute is never mutated by a
   *  fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.keyboardChanged = false;
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Mirror lr-split's cleanup: if the element is removed mid-drag (or a
    // pointercancel/alt-tab means `pointerup` never reaches `window`), these
    // window-level listeners — and the closure keeping this instance alive —
    // would otherwise leak indefinitely.
    this.drags.clear();
    this.keyboardChanged = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
  }

  /** Activates the start handle, mirroring `<lr-switch>`'s identical `override click()`. Without
   *  this, `HTMLElement.prototype.click()` on the host is a no-op: no click handler is bound to
   *  the host itself, only to the internal `[part="handle-start"]`/`[part="handle-end"]`
   *  controls. Targets the start handle specifically, matching `focus()` below; `blur()` instead
   *  follows whichever handle currently owns focus. */
  override click(): void {
    if (!this.effectiveDisabled) {
      (this.renderRoot?.querySelector('[part="handle-start"]') as HTMLElement | null)?.click();
    }
  }

  /** Moves focus to the start handle. */
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) {
      (this.renderRoot?.querySelector('[part="handle-start"]') as HTMLElement | null)?.focus(options);
    }
  }

  /** Removes focus from whichever handle currently owns it. */
  override blur(): void {
    const active = activeElementIn(this.shadowRoot);
    if (active instanceof HTMLElement && active.matches('[part^="handle-"]')) active.blur();
    else (this.renderRoot?.querySelector('[part="handle-start"]') as HTMLElement | null)?.blur();
  }

  // Both percentOf() and clamp() key off this same lo/hi pair — willUpdate()
  // already normalizes a caller-supplied `min > max` domain this way, so
  // rendering and interactive dragging must agree with it instead of
  // indexing off this.min/this.max directly (which inverts the visuals and
  // locks dragging to a fixed value when min > max).
  private domain(): { lo: number; hi: number } {
    // A caller-supplied min/max that fails Number attribute conversion (e.g.
    // `min="not-a-number"`) arrives here as NaN; Math.min/Math.max would
    // otherwise propagate that NaN into `lo`/`hi` and poison every
    // percentOf()/clamp() caller. Mirror lr-gauge's `ratio` getter, which
    // short-circuits on isNaN(...) instead, by falling back to this
    // property's own default.
    const min = finiteNumber(this.min, 0);
    const max = finiteNumber(this.max, 100);
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  private percentOf(value: number): number {
    // A NaN `start`/`end` (e.g. an invalid `start` attribute) must not reach
    // the rendered `inset-inline-start:NaN%` — that's an invalid CSS value
    // the browser silently drops, leaving the handle stuck with no visible
    // recovery. 0% is at least a stable, well-defined position.
    const { lo, hi } = this.domain();
    const safeValue = finiteRange(value, lo, lo, hi);
    return finiteRatio(safeValue, lo, hi) * 100;
  }

  /** Each handle's actual reachable sub-range, bounded by its sibling
   *  handle's current value the same way clamp() already enforces it — used
   *  both for aria-valuemin/aria-valuemax and for Home/End's jump targets,
   *  instead of reporting/jumping to the component's full [min, max] domain
   *  which the sibling handle may make partially unreachable. */
  private reachableBounds(handle: TimeRangeHandle): { min: number; max: number } {
    const { lo, hi } = this.domain();
    // A NaN sibling value (e.g. an invalid `end` attribute) must not leak
    // into the *other* handle's aria-valuemin/aria-valuemax as a literal
    // "NaN" — fall back to the domain bound it would otherwise report.
    const start = finiteRange(this.start, lo, lo, hi);
    const end = finiteRange(this.end, hi, lo, hi);
    return handle === 'start' ? { min: lo, max: end } : { min: start, max: hi };
  }

  private clamp(handle: TimeRangeHandle, value: number): number {
    const { lo, hi } = this.domain();
    // A non-positive or non-finite step (e.g. a transient `step={0}` while a
    // caller derives it as `(max-min)/tickCount`) would otherwise divide by
    // zero/NaN below and permanently poison start/end with NaN, since the
    // other handle's clamp cross-references this one's (already-NaN) value.
    // Treat it as "unstepped" instead of propagating NaN.
    // Anchor the step grid at the domain's own `lo` (matching native
    // `<input type=range>`) instead of absolute 0 — otherwise a `min` that
    // isn't itself a multiple of `step` makes the very first nudge off `min`
    // jump to the nearest multiple-of-step-from-zero instead of moving by
    // one `step`. Round the result back to `step`'s own decimal precision
    // (rather than leaving raw `value / step` binary-float noise in place)
    // so repeated steps land on exact values like 20.1 instead of
    // 20.200000000000003.
    let stepped = finiteNumber(value, lo);
    const step = finiteRange(this.step, 0, 0);
    if (Number.isFinite(step) && step > 0) {
      const stepsFromLo = Math.round((stepped - lo) / step);
      if (Number.isFinite(stepsFromLo)) {
        const candidate = lo + stepsFromLo * step;
        const factor = 10 ** Math.min(decimalPlaces(step), 15);
        if (Number.isFinite(candidate)) {
          stepped = Number.isFinite(candidate * factor)
            ? Math.round(candidate * factor) / factor
            : candidate;
        }
      }
    }
    const bounded = Math.min(hi, Math.max(lo, stepped));
    if (handle === 'start') return Math.min(bounded, finiteRange(this.end, hi, lo, hi));
    return Math.max(bounded, finiteRange(this.start, lo, lo, hi));
  }

  private setValue(handle: TimeRangeHandle, value: number, commit: boolean): boolean {
    const clamped = this.clamp(handle, value);
    const previous = handle === 'start' ? this.start : this.end;
    if (clamped === previous) return false;
    if (handle === 'start') this.start = clamped;
    else this.end = clamped;
    // A handle that actually moved is an interaction the instant it happens, the same way a
    // toggle is for `<lr-checkbox>` — that is what turns the `user-*` custom states on.
    this.markInteracted();
    this.emitInput();
    if (commit) this.emitChange();
    return true;
  }

  /**
   * Apply a discrete preset: sets both handles and emits the same
   * lr-input/lr-change pair a committed drag or keyboard step would.
   *
   * Deliberately bypasses `setValue()`/`clamp()` — a preset is an explicit
   * discrete jump to the caller's own exact numbers, not a stepped nudge, so
   * routing it through `clamp()`'s step-grid rounding would silently round
   * a preset's values away from what the caller specified (and desync the
   * active-button match in render(), which compares against these exact
   * numbers). Only the domain bounds and the start<=end invariant apply
   * here, not `step`. Both handles are also assigned before either event
   * fires — routing them through two sequential `setValue()` calls instead
   * would emit an extra lr-input whose detail still held the stale
   * pre-preset value for whichever handle hadn't been assigned yet.
   */
  private applyPreset(preset: TimeRangePreset): void {
    if (this.effectiveDisabled) return;
    const { lo, hi } = this.domain();
    const start = finiteRange(preset.start, lo, lo, hi);
    const end = finiteRange(preset.end, hi, lo, hi);
    const nextStart = Math.min(start, end);
    const nextEnd = Math.max(start, end);
    if (nextStart === this.start && nextEnd === this.end) return;
    this.start = nextStart;
    this.end = nextEnd;
    this.markInteracted();
    this.emitInput();
    this.emitChange();
  }

  private onKeyDown = (handle: TimeRangeHandle, e: KeyboardEvent): void => {
    // A handle that already has focus when the component becomes disabled
    // must not still respond to arrow keys (new pointerdowns are already
    // blocked by the `if (this.effectiveDisabled) return;` guard in
    // onPointerDown, and disabled handles carry `tabindex="-1"`, but a
    // pre-existing focus can bypass both of those).
    if (this.effectiveDisabled) return;
    const current =
      handle === 'start'
        ? finiteRange(this.start, this.domain().lo)
        : finiteRange(this.end, this.domain().hi);
    // Mirror the same left/right swap as onPointerMove: under RTL, physical
    // ArrowRight moves toward inset-inline-start, i.e. a lower value.
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey || e.key === 'ArrowUp') {
      e.preventDefault();
      this.keyboardChanged = this.setValue(handle, current + this.step, false) || this.keyboardChanged;
    } else if (e.key === backwardKey || e.key === 'ArrowDown') {
      e.preventDefault();
      this.keyboardChanged = this.setValue(handle, current - this.step, false) || this.keyboardChanged;
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      this.keyboardChanged =
        this.setValue(handle, current + this.step * PAGE_STEP_MULTIPLIER, false) ||
        this.keyboardChanged;
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      this.keyboardChanged =
        this.setValue(handle, current - this.step * PAGE_STEP_MULTIPLIER, false) ||
        this.keyboardChanged;
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.keyboardChanged =
        this.setValue(handle, this.reachableBounds(handle).min, false) || this.keyboardChanged;
    } else if (e.key === 'End') {
      e.preventDefault();
      this.keyboardChanged =
        this.setValue(handle, this.reachableBounds(handle).max, false) || this.keyboardChanged;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // Only commit on release of the keys that onKeyDown acts on — releasing
    // an unrelated key (Tab, Shift, ...) while a handle happens to be
    // focused must not emit a spurious lr-change.
    if (this.effectiveDisabled || !isSliderKey(e.key) || !this.keyboardChanged) return;
    this.keyboardChanged = false;
    this.emitChange();
  };

  private onPointerDown = (handle: TimeRangeHandle, e: PointerEvent): void => {
    if (this.effectiveDisabled) return;
    const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement;
    this.drags.set(e.pointerId, {
      handle,
      changed: false,
      rect: base.getBoundingClientRect(),
      rtl: isRtl(this),
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire `pointercancel`, and losing capture (e.g. element removed)
    // fires `lostpointercapture` — both need the same teardown as pointerup
    // or `this.drags` keeps a permanently-stale entry and these window
    // listeners (and the closure keeping this instance alive) never get
    // removed. Mirrors lr-split's identical fix.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drags.get(e.pointerId);
    if (drag === undefined) return;
    if (this.effectiveDisabled) {
      // These are window-level listeners driven by setPointerCapture, so
      // they keep firing for this pointerId regardless of any CSS on the
      // host (this was already true even back when the host used
      // `pointer-events: none`, since that never governed an
      // already-captured window listener) — a drag already in progress
      // would otherwise keep mutating start/end (and emitting lr-input)
      // after `disabled` (or an ancestor fieldset) flips true mid-drag.
      // Abort the drag instead of continuing to process it.
      this.endDrag(e.pointerId, false);
      return;
    }
    const rect = drag.rect;
    const raw = (e.clientX - rect.left) / rect.width;
    // The track is positioned with inset-inline-start (0% at the visual
    // right edge under RTL), so the pointer ratio has to mirror that or a
    // rightward drag would move the handle the wrong way.
    const ratio = Math.min(1, Math.max(0, drag.rtl ? 1 - raw : raw));
    const { lo, hi } = this.domain();
    const value = finiteInterpolate(lo, hi, ratio);
    drag.changed = this.setValue(drag.handle, value, false) || drag.changed;
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.endDrag(e.pointerId, e.type === 'pointerup');
  };

  /** Stop the drag owned by `pointerId`, optionally committing a final lr-change. */
  private endDrag(pointerId: number, commit: boolean): void {
    const drag = this.drags.get(pointerId);
    if (!drag) return;
    this.drags.delete(pointerId);
    if (commit && drag.changed) this.emitChange();
    // Only the last concurrent drag to end tears down the shared window
    // listeners — another pointer (e.g. the other finger of a two-finger
    // drag) may still be down.
    if (this.drags.size === 0) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('lostpointercapture', this.onPointerUp);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    // A future mixin layered under LyraTimeRange would otherwise silently never run its own
    // willUpdate() -- mirrors this same file's disconnectedCallback(), which already calls
    // super.disconnectedCallback() for the identical reason.
    super.willUpdate(changed);
    if (
      changed.has('start') ||
      changed.has('end') ||
      changed.has('min') ||
      changed.has('max')
    ) {
      // Clamp both handles into the current [min, max] domain first — a
      // caller narrowing the domain after mount (e.g. zooming the time
      // axis via `el.max = 50`) must not leave a handle rendered outside
      // the track, since percentOf() would otherwise produce <0%/>100%.
      // Guard against a caller passing min > max so the bounds themselves
      // stay well-formed.
      const { lo, hi } = this.domain();
      if (Number.isFinite(this.start)) this.start = finiteRange(this.start, lo, lo, hi);
      if (Number.isFinite(this.end)) this.end = finiteRange(this.end, hi, lo, hi);
    }
    // Keep start <= end regardless of which side changed (a controlled
    // caller may set only `end`, e.g. two-way-binding an external store).
    // The handle that just moved wins; the other side is pulled to meet it,
    // mirroring the direction `clamp()` already uses during interactive
    // dragging.
    if (
      (changed.has('start') || changed.has('min') || changed.has('max')) &&
      Number.isFinite(this.start) &&
      Number.isFinite(this.end)
    ) {
      this.start = Math.min(this.start, this.end);
    }
    if (
      (changed.has('end') || changed.has('min') || changed.has('max')) &&
      Number.isFinite(this.start) &&
      Number.isFinite(this.end)
    ) {
      this.end = Math.max(this.end, this.start);
    }
  }

  override render(): TemplateResult {
    const startPct = this.percentOf(this.start);
    const endPct = this.percentOf(this.end);
    const startBounds = this.reachableBounds('start');
    const endBounds = this.reachableBounds('end');
    const startValue = Number.isFinite(this.start)
      ? finiteRange(this.start, startBounds.min, startBounds.min, startBounds.max)
      : undefined;
    const endValue = Number.isFinite(this.end)
      ? finiteRange(this.end, endBounds.min, endBounds.min, endBounds.max)
      : undefined;
    const startValueText =
      startValue === undefined ? undefined : this.valueFormatter?.(startValue, 'start');
    const endValueText =
      endValue === undefined ? undefined : this.valueFormatter?.(endValue, 'end');
    return html`
      ${this.presets.length > 0
        ? html`<div part="presets">
            ${this.presets.map((preset) => {
              const active = preset.start === this.start && preset.end === this.end;
              return html`<button
                part="preset-button"
                type="button"
                ?disabled=${this.effectiveDisabled}
                aria-pressed=${active ? 'true' : 'false'}
                ?data-active=${active}
                @click=${() => this.applyPreset(preset)}
              >
                ${preset.label}
              </button>`;
            })}
          </div>`
        : nothing}
      <div part="base">
        <div part="track"></div>
        <div
          part="range"
          style=${`inset-inline-start:${startPct}%;inline-size:${endPct - startPct}%`}
        ></div>
        <div
          part="handle-start"
          role="slider"
          tabindex=${this.effectiveDisabled ? '-1' : '0'}
          aria-label=${this.localize(
            'rangeStart',
            this.startLabel === 'Range start' ? undefined : this.startLabel,
          )}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          aria-valuemin=${startBounds.min}
          aria-valuemax=${startBounds.max}
          aria-valuenow=${startValue ?? nothing}
          aria-valuetext=${startValueText ?? nothing}
          ?data-at-domain-start=${startPct === 0}
          ?data-at-domain-end=${startPct === 100}
          style=${`inset-inline-start:${startPct}%`}
          @pointerdown=${(e: PointerEvent) => this.onPointerDown('start', e)}
          @keydown=${(e: KeyboardEvent) => this.onKeyDown('start', e)}
          @keyup=${(e: KeyboardEvent) => this.onKeyUp(e)}
          @focus=${this.onHandleFocus}
          @blur=${this.onHandleBlur}
        ></div>
        <div
          part="handle-end"
          role="slider"
          tabindex=${this.effectiveDisabled ? '-1' : '0'}
          aria-label=${this.localize(
            'rangeEnd',
            this.endLabel === 'Range end' ? undefined : this.endLabel,
          )}
          aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
          aria-valuemin=${endBounds.min}
          aria-valuemax=${endBounds.max}
          aria-valuenow=${endValue ?? nothing}
          aria-valuetext=${endValueText ?? nothing}
          ?data-at-domain-start=${endPct === 0}
          ?data-at-domain-end=${endPct === 100}
          style=${`inset-inline-start:${endPct}%`}
          @pointerdown=${(e: PointerEvent) => this.onPointerDown('end', e)}
          @keydown=${(e: KeyboardEvent) => this.onKeyDown('end', e)}
          @keyup=${(e: KeyboardEvent) => this.onKeyUp(e)}
          @focus=${this.onHandleFocus}
          @blur=${this.onHandleBlur}
        ></div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-time-range': LyraTimeRange;
  }
}
