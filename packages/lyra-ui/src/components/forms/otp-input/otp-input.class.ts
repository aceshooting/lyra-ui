import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated, isBarredFromValidation } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { nextId } from '../../../internal/a11y.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { contextualSizes } from '../../../internal/contextual-vocabulary.styles.js';
import { findImplicitSubmitter, isNativeSubmitter, submitOnEnter } from '../../../internal/submit-on-enter.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import { styles } from './otp-input.styles.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
import { declaredDefaultConverter } from "../../../internal/converters.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_otpInputIncomplete, LYRA_DEFAULT_otpInputLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Which characters a segment accepts. */
export type OtpInputType = 'numeric' | 'alpha' | 'alphanumeric';
/** Case transform applied as characters are entered. */
export type OtpInputCase = 'preserve' | 'upper' | 'lower';
/** Direction of the native compact-string selection exposed by the host editing facade. */
export type OtpInputSelectionDirection = 'forward' | 'backward' | 'none';
/** Segment fill treatment, including the OTP-specific joined `contained` treatment. */
export type OtpInputAppearance =
  | Extract<LyraAppearance, 'outlined' | 'filled' | 'filled-outlined'> | 'contained';

const ACCEPTED: Record<OtpInputType, RegExp> = {
  numeric: /[0-9]/,
  alpha: /[a-zA-Z]/,
  alphanumeric: /[a-zA-Z0-9]/,
};

const DEFAULT_LENGTH = 6;
// A guard, not a design limit: `length` reaches a template repeat and a `maxlength`, so an absurd
// value from an attribute would render an absurd number of nodes.
const MAX_LENGTH = 32;
const MAX_FORMAT_SOURCE_LENGTH = 4_096;
const MAX_VALUE_SOURCE_LENGTH = 4_096;

/** One rendered cell: either an entry segment or a literal separator from `format`. */
type Cell = { kind: 'segment' } | { kind: 'separator'; text: string };

export interface LyraOtpInputEventMap {
  input: InputEvent;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<null>;
  'lr-blur': CustomEvent<null>;
  'lr-clear': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
  'lr-complete': CustomEvent<{ value: string }>;
}

class LyraOtpInputBase extends LyraElement<LyraOtpInputEventMap> {
  static override styles = [LyraElement.styles, contextualSizes, styles];
}

/**
 * `<lr-otp-input>` — a form-associated one-time-code field: several character segments that
 * together hold one value.
 *
 * The segments are presentational. A single real `<input>` sits transparently across them and owns
 * focus, selection and the value. It remains the native integration point for SMS autofill
 * (`autocomplete` defaults to `one-time-code`), IME composition and mobile keyboards, and keeps the
 * control to one tab stop rather than one per character. Fixed-cell keyboard and paste handlers map
 * native editing intents into the visual cells without exposing one input per character.
 *
 * Programmatic `value` writes, default propagation, form resets, and browser state restoration all
 * pass through the same sanitizer as typing and remain event-silent. `resetValidity()` clears a
 * consumer-supplied custom error while restoring the current intrinsic constraints.
 *
 * Keyboard editing uses fixed cells: physical Left/Right move to the visually adjacent segment
 * (with the index delta mirrored under RTL), Backspace clears the current cell and moves back,
 * Delete clears it in place, and neither deletion shifts trailing characters. A bare Enter flushes
 * a pending `change` and requests one submission from the owning form through the shared
 * Enter-to-submit gate, so a modifier-held Enter, an Enter that commits an IME candidate, and an
 * Enter a listener above has already vetoed all leave the form alone, and the form's default button
 * reaches the submission as `SubmitEvent.submitter`. A full paste into an empty field fills accepted characters from
 * the first cell in one input operation. The public/submitted string concatenates occupied cells;
 * middle empty cells are a visual editing state and are not encoded in that string. A nonempty
 * native selection maps its compact offsets back to occupied cells for replacement or deletion.
 * The host forwards the native selection getters, setters, and range-editing methods against that
 * same compact string. Range edits pass through the sanitizer, synchronize form value and
 * validity, and remain event-silent like a programmatic `value` write.
 *
 * Component-scoped theme inputs remain undeclared on the host, so values inherited from an
 * ancestor theme wrapper override appearance fallbacks. A value set directly on the OTP input
 * still wins through normal custom-property inheritance.
 *
 * @customElement lr-otp-input
 * @slot label - Rich label content used while the `label` attribute is empty.
 * @slot hint - Rich supporting text used while the `hint` attribute is empty.
 * @slot error - Rich validation text, replacing the `errorText` attribute.
 * @event input - The real input changed; relayed as one native `InputEvent` with its editing
 *   payload intact. Intermediate IME composition waits for the final non-composing event.
 * @event change - The value changed and the field settled on blur or Enter; relayed as one native
 *   `Event`.
 * @event focus - Native focus relayed once from the real input.
 * @event blur - Native blur relayed once from the real input.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-clear - The value was cleared. Bubbling, composed, and non-cancelable.
 * @event lr-invalid - The one-time-code input failed a validity check. Cancelable:
 * `preventDefault()` forwards to the native `invalid` event, suppressing the browser's own
 * validation bubble and the focus/scroll `reportValidity()` would otherwise perform.
 * @event lr-complete - The field transitions from incomplete to every segment filled.
 * `detail: { value }`. Cancelable; preventing it suppresses `autosubmit` for that completion. The
 * autosubmission is deferred one task, so a listener may call `preventDefault()` after an `await`.
 * @cssstate --blank - Matches while no characters have been entered.
 * @cssstate --filled - Matches while every segment is filled.
 * @cssstate disabled - Matches while the control is disabled, including through a fieldset.
 * @cssstate readonly - Matches while `readonly` is set.
 * @cssstate required - Matches while `required` is set. Style with `lr-otp-input:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: typing, a blur, or a
 * `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required field is genuinely invalid, but colouring it red
 * before the user has entered a digit is hostile.
 * @csspart base - The outer wrapper; retained alias for `form-control`.
 * @csspart form-control - The outer wrapper; shared form-control alias for `base`.
 * @csspart label - The field label; retained alias for `form-control-label`.
 * @csspart form-control-label - The field label; shared form-control alias for `label`.
 * @csspart field - Retained Lyra alias for the row of segments.
 * @csspart segments - The allocation-bounded, horizontally scrollable row of fixed-size segments;
 *   it carries the shared minimum target floor.
 * @csspart control - The real, visually transparent input.
 * @csspart segment - One character segment. Carries `active`, `masked`, `placeholder-mask` and
 * `invalid` in the part name so a consumer can target any of those states through `::part()`.
 * @csspart separator - Retained Lyra alias for a literal separator emitted by `format`.
 * @csspart segment-literal - A literal separator emitted by `format`.
 * @csspart hint - Supporting text.
 * @csspart error - Validation text.
 * @cssprop [--lr-otp-input-mask-char='•'] - The glyph shown for a masked character, and for every
 * empty segment while `with-mask` is set. Must be a quoted string, because it is used as CSS
 * `content`.
 * @cssprop [--mask-char='•'] - Mapped alias for `--lr-otp-input-mask-char`.
 * @cssprop [--segment-border-radius=var(--lr-form-control-radius,var(--lr-radius))] - Corner radius
 *   of a segment.
 * @cssprop [--segment-gap=var(--lr-space-xs)] - Gap between segments; ignored by `contained`.
 * @cssprop [--segment-size=2.5em] - Exact inline and block size of each non-shrinking segment at
 *   the default size tier.
 * @cssprop [--lr-otp-input-segment-size=var(--lr-theme-otp-input-segment-size,2.5em)] - Internal
 *   role token supplying the standalone segment size when `--segment-size` is unset.
 * @cssprop [--lr-otp-input-segment-border-color=var(--lr-color-border)] - Border color of each
 *   segment.
 * @cssprop [--lr-otp-input-segment-fill=transparent] - Background fill of each segment.
 * @cssprop [--lr-otp-input-segment-radius=var(--lr-form-control-radius,var(--lr-radius))] -
 *   Corner radius of each segment.
 * @cssprop [--lr-otp-input-active-border-color=var(--lr-focus-ring-color)] - Active segment border.
 * @cssprop [--lr-otp-input-active-ring-color=var(--lr-focus-ring-color)] - Active segment outer ring.
 * @cssprop [--lr-otp-input-invalid-border-color=var(--lr-color-danger)] - Invalid segment border.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @status stable
 * @since 8.0.0
 */
export class LyraOtpInput extends FormAssociated(LyraOtpInputBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    otpInputIncomplete: LYRA_DEFAULT_otpInputIncomplete,
    otpInputLabel: LYRA_DEFAULT_otpInputLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraOtpInput>[] {
    return [currentValidityValidator('required', 'disabled', 'readonly', 'value', 'length', 'pattern')];
  }
  /** Visible label. When nonempty, it takes precedence over rich `label`-slot content. */
  @property() label = '';
  /** Supporting text below the field. When nonempty, it takes precedence over the `hint` slot. */
  @property() hint = '';
  /** Validation text shown immediately below the field. It sets the internal input's ARIA invalid
   *  state; rich `error`-slot content takes precedence when supplied. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Visual fill treatment for each segment, or a single joined `contained` field. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<OtpInputAppearance>("outlined"),
  }) appearance: OtpInputAppearance = 'outlined';
  /** Automatically focus the real input after the first client render. */
  @property({ type: Boolean }) override autofocus = false;
  /** Submit the owning form after an un-canceled `lr-complete`, one task later so an asynchronous
   *  listener can still veto it. Replacing or restoring the code before that task runs cancels
   *  the stale submission. The form's default button is resolved as the submitter. */
  @property({ type: Boolean, reflect: true }) autosubmit = false;
  /** Segment size on the shared form-control ladder. An unset size inherits its containing context;
   *  standalone rendering falls back to `m`. */
  @property({ reflect: true, useDefault: true }) size: LyraSize = 'm';
  /** Number of character segments. Ignored when `format` is set. */
  @property({ type: Number, reflect: true,
    converter: declaredDefaultConverter(DEFAULT_LENGTH),
  }) length = DEFAULT_LENGTH;
  /**
   * Segment layout with literal separators — `#` marks a segment, any other character becomes a
   * separator. `format="###-###"` renders two groups of three joined by a dash. Overrides `length`
   * when its bounded parsed prefix contains at least one `#`; a literal-only parsed prefix falls
   * back to `length`. Only the first 4,096 UTF-16 code units are parsed, and no more than 32
   * segments are retained.
   */
  @property() format = '';
  /** Which characters are accepted; also drives the mobile keyboard through `inputmode`. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<OtpInputType>("numeric"),
  }) type: OtpInputType = 'numeric';
  /** Case transform applied as characters are entered. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<OtpInputCase>("preserve"),
  }) case: OtpInputCase = 'preserve';
  /** Show entered characters as the mask glyph instead of their real value. Display-only. */
  @property({ type: Boolean, reflect: true }) mask = false;
  /**
   * Show the mask glyph in empty segments, so the field reads as a fixed-length code before any
   * entry. Independent of `mask`: entered characters stay visible unless `mask` is also set.
   */
  @property({ type: Boolean, reflect: true, attribute: 'with-mask' }) withMask = false;
  /** Display the value without allowing edits. Unlike `disabled`, it still submits and focuses;
   *  intrinsic required/completeness validity is suspended until editing is enabled again. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Native autofill hint. Defaults to the SMS one-time-code value. */
  @property({ reflect: true,
    converter: declaredDefaultConverter("one-time-code"),
  }) autocomplete = 'one-time-code';

  @state() private focused = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  /** Intrinsic invalid styling is only shown once the user has actually engaged with the field. */
  @state() private touched = false;

  @query('[part="control"]') private control?: HTMLInputElement;

  private readonly labelId = nextId('otp-input-label');
  private readonly hintId = nextId('otp-input-hint');
  private readonly errorId = nextId('otp-input-error');
  @state() private activeSegmentIndex = 0;
  private segmentValues: string[] = [];
  private segmentEditPendingChange = false;
  /** Invalidates a deferred autosubmission whose completion has since been superseded. */
  private autosubmitToken = 0;
  private parsedFormatSource?: string;
  private parsedFormatCells?: Cell[] | null;

  /** The real native input used for focus, selection, autofill, and IME. */
  get input(): HTMLInputElement | null {
    return this.control ?? null;
  }

  /** Native control passed to constraint-validation UI as its visual anchor. */
  get validationTarget(): HTMLInputElement | null {
    return this.control ?? null;
  }

  /** Live value normalized through the same character/length contract as native editing. At most
   * the first 4,096 UTF-16 code units are inspected, stopping earlier once every segment is full. */
  override get value(): string {
    return super.value;
  }

  override set value(next: string | null) {
    this.autosubmitToken += 1;
    const normalized = this.sanitize(next ?? '');
    this.packSegmentValues(normalized);
    super.value = normalized;
  }

  /** The reset default uses the same sanitizer when it becomes live; changing it also retires a
   *  queued autosubmission, even while a dirty live value prevents immediate propagation. */
  override get defaultValue(): string {
    return super.defaultValue;
  }

  override set defaultValue(next: string) {
    this.autosubmitToken += 1;
    super.defaultValue = next;
  }

  /** Parses a bounded source prefix, at most 32 segments, and coalesces every literal run into one
   * cell, so an adversarial format cannot cause unbounded preprocessing or template output. */
  private get formattedCells(): Cell[] | null {
    if (this.parsedFormatSource === this.format) return this.parsedFormatCells ?? null;
    this.parsedFormatSource = this.format;
    if (!this.format) {
      this.parsedFormatCells = null;
      return null;
    }

    const cells: Cell[] = [];
    let segments = 0;
    let literal = '';
    const flushLiteral = (): void => {
      if (!literal) return;
      cells.push({ kind: 'separator', text: literal });
      literal = '';
    };
    for (const char of this.format.slice(0, MAX_FORMAT_SOURCE_LENGTH)) {
      if (char !== '#') {
        literal += char;
        continue;
      }
      if (segments >= MAX_LENGTH) break;
      flushLiteral();
      cells.push({ kind: 'segment' });
      segments += 1;
    }
    flushLiteral();
    this.parsedFormatCells = segments > 0 ? cells : null;
    return this.parsedFormatCells;
  }

  /** Segment count actually rendered: a valid `format`'s `#` count, else `length`. */
  private get renderedSegmentCount(): number {
    const formatted = this.formattedCells;
    if (formatted) return formatted.filter((cell) => cell.kind === 'segment').length;
    return Math.min(MAX_LENGTH, Math.max(1, finiteInteger(this.length, DEFAULT_LENGTH)));
  }

  /** Mapped read-only name for the number of segments derived from `format` or `length`. */
  get effectiveLength(): number {
    return this.renderedSegmentCount;
  }

  private get cells(): Cell[] {
    return (
      this.formattedCells ?? Array.from({ length: this.renderedSegmentCount }, () => ({ kind: 'segment' as const }))
    );
  }

  /** Scans a bounded source prefix, drops characters the current `type` rejects, applies `case`,
   * and truncates to the rendered count — the single funnel every live path goes through. */
  private sanitize(raw: string): string {
    const accepted = ACCEPTED[this.type] ?? ACCEPTED.numeric;
    const limit = this.renderedSegmentCount;
    let out = '';
    for (const char of (raw ?? '').slice(0, MAX_VALUE_SOURCE_LENGTH)) {
      if (accepted.test(char)) out += char;
      if (out.length >= limit) break;
    }
    // The declared alpha vocabulary is ASCII. Locale-sensitive Turkish casing would turn i/I into
    // İ/ı, producing characters the same sanitizer says are not accepted.
    if (this.case === 'upper') out = out.toUpperCase();
    else if (this.case === 'lower') out = out.toLowerCase();
    return out.slice(0, limit);
  }

  private packSegmentValues(value: string): void {
    const count = this.renderedSegmentCount;
    this.segmentValues = Array.from({ length: count }, (_, index) => value[index] ?? '');
    this.activeSegmentIndex = Math.min(value.length, count - 1);
  }

  private get filledSegmentCount(): number {
    if (!Array.isArray(this.segmentValues)) return this.value.length;
    return this.segmentValues.reduce((count, value) => count + (value ? 1 : 0), 0);
  }

  private normalizedSegmentValues(values = this.segmentValues): string[] {
    return Array.from({ length: this.renderedSegmentCount }, (_, index) => values[index] ?? '');
  }

  private setActiveSegment(index: number): void {
    const next = Math.min(this.renderedSegmentCount - 1, Math.max(0, index));
    this.activeSegmentIndex = next;
    const caret = this.normalizedSegmentValues().slice(0, next).filter(Boolean).length;
    this.control?.setSelectionRange(caret, caret);
    void this.updateComplete.then(() => {
      const segment = this.renderRoot.querySelectorAll<HTMLElement>('[part~="segment"]')[next];
      segment?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  /**
   * Submits the owning form the way `internal/submit-on-enter.ts` does for a keystroke: through the
   * form's resolved default button, so `SubmitEvent.submitter` — and with it the button's own
   * `name`/`value` entry and its `formaction`/`formmethod`/`formnovalidate` overrides — survives an
   * autosubmission exactly as it survives a real click. `requestSubmit()`, never `submit()`, so
   * interactive constraint validation still runs.
   */
  private submitOwningForm(): void {
    const form = this.getForm();
    if (!form) return;
    const submitter = findImplicitSubmitter(form);
    if (!submitter) form.requestSubmit();
    else if (isNativeSubmitter(submitter)) {
      form.requestSubmit(submitter);
    } else {
      // A form-associated custom element is never a legal `requestSubmit()` submitter (the platform
      // throws a TypeError for one); its own `click()` runs the submit path a real click would.
      submitter.click();
    }
  }

  private completeIfTransition(previousFilled: number): void {
    if (previousFilled >= this.renderedSegmentCount || this.filledSegmentCount !== this.renderedSegmentCount) return;
    const completionValue = this.value;
    const token = this.autosubmitToken;
    const completeEvent = this.emit('lr-complete', { value: completionValue }, { cancelable: true });
    if (!this.autosubmit) return;
    // One task later, not synchronously: `lr-complete` is a real veto point, and a listener that
    // decides asynchronously (checking the code before letting the form go) has to be able to call
    // `preventDefault()` after its own `await`. The captured generation/value plus connectivity and
    // completeness re-checks make a code that changed again in that window drop the stale submit.
    setTimeout(() => {
      if (token !== this.autosubmitToken || completeEvent.defaultPrevented) return;
      if (!this.isConnected || !this.autosubmit) return;
      if (this.value !== completionValue || this.filledSegmentCount !== this.renderedSegmentCount) return;
      this.submitOwningForm();
    });
  }

  private commitSegmentEdit(values: string[], inputType: string, data: string | null = null): void {
    this.autosubmitToken += 1;
    const previousValue = this.value;
    const previousFilled = this.filledSegmentCount;
    this.segmentValues = this.normalizedSegmentValues(values);
    const nextValue = this.segmentValues.join('');
    super.value = nextValue;
    if (this.control) this.control.value = nextValue;
    this.touched = true;
    dispatchNativeInputEvent(this, { data, inputType });
    this.segmentEditPendingChange = true;
    if (previousValue && !nextValue) this.emit('lr-clear');
    this.completeIfTransition(previousFilled);
    this.requestUpdate();
  }

  /** Maps the real input's compact-string selection back to the occupied visual cells. Empty
   * fixed cells have no public-string offset, so they are deliberately skipped. */
  private get selectedSegmentRange(): { indices: number[]; first: number;
  } | null {
    const start = this.control?.selectionStart;
    const end = this.control?.selectionEnd;
    if (start === undefined || start === null || end === undefined || end === null || start === end) {
      return null;
    }
    const occupiedIndices = this.normalizedSegmentValues()
      .map((value, index) => (value ? index : -1))
      .filter((index) => index >= 0);
    const indices = occupiedIndices.slice(start, end);
    const first = indices[0];
    return first === undefined ? null : { indices, first };
  }

  /** Maps a compact-string caret offset to the first visual cell at that boundary. */
  private segmentIndexAtCompactOffset(offset: number): number {
    const values = this.normalizedSegmentValues();
    let occupied = 0;
    for (let index = 0; index < values.length; index += 1) {
      if (occupied >= offset) return index;
      if (values[index]) occupied += 1;
    }
    return Math.max(0, values.length - 1);
  }

  /** Keeps fixed-cell keyboard editing aligned with a public compact-string selection write. */
  private syncActiveSegmentFromSelection(): void {
    const control = this.control;
    if (!control || control.selectionStart === null) return;
    const selected = this.selectedSegmentRange;
    this.activeSegmentIndex = selected?.first ?? this.segmentIndexAtCompactOffset(control.selectionStart);
  }

  /** Start offset of the native compact-string selection, or `null` before first render. */
  get selectionStart(): number | null {
    return this.control?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (!this.control) return;
    this.control.selectionStart = value;
    this.syncActiveSegmentFromSelection();
  }

  /** End offset of the native compact-string selection, or `null` before first render. */
  get selectionEnd(): number | null {
    return this.control?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (!this.control) return;
    this.control.selectionEnd = value;
    this.syncActiveSegmentFromSelection();
  }

  /** Direction of the native compact-string selection, or `null` before first render. */
  get selectionDirection(): OtpInputSelectionDirection | null {
    return this.control?.selectionDirection ?? null;
  }

  set selectionDirection(value: OtpInputSelectionDirection | null) {
    if (this.control) this.control.selectionDirection = value;
  }

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.control?.focus(options);
  }
  override blur(): void {
    this.control?.blur();
  }
  override click(): void {
    if (!this.effectiveDisabled) this.control?.click();
  }
  /** Selects the whole compact code. Fixed-cell typing or deletion honors the selected range. */
  select(): void {
    this.control?.select();
  }
  /** Sets the selection on the compact code and maps its start back to the visual fixed cells. */
  setSelectionRange(start: number | null, end: number | null, direction?: OtpInputSelectionDirection): void {
    if (!this.control) return;
    this.control.setSelectionRange(start, end, direction);
    this.syncActiveSegmentFromSelection();
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  /**
   * Applies a silent native range edit to the compact code, then normalizes the result through the
   * same sanitizer as typing and synchronizes visual cells, form value, and validity. Both the
   * existing native value and replacement are bounded before reaching the native editing method.
   */
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    const control = this.control;
    if (!control) return;
    const selectionPrefixLength = (value: string, offset: number | null): number | null => {
      if (offset === null) return null;
      const boundedOffset = Math.min(MAX_VALUE_SOURCE_LENGTH, Math.max(0, offset));
      return this.sanitize(value.slice(0, boundedOffset)).length;
    };

    const currentRaw = control.value;
    const currentSelectionStart = selectionPrefixLength(currentRaw, control.selectionStart);
    const currentSelectionEnd = selectionPrefixLength(currentRaw, control.selectionEnd);
    const currentSelectionDirection = control.selectionDirection;
    const boundedCurrent = this.sanitize(currentRaw);
    if (currentRaw !== boundedCurrent) {
      control.value = boundedCurrent;
      if (currentSelectionStart !== null && currentSelectionEnd !== null) {
        control.setSelectionRange(
          currentSelectionStart,
          currentSelectionEnd,
          currentSelectionDirection ?? undefined,
        );
      }
    }

    const boundedReplacement = this.sanitize(replacement);
    if (start === undefined || end === undefined) {
      control.setRangeText(boundedReplacement);
    } else {
      control.setRangeText(boundedReplacement, start, end, selectMode);
    }

    const raw = control.value;
    const selectionStart = selectionPrefixLength(raw, control.selectionStart);
    const selectionEnd = selectionPrefixLength(raw, control.selectionEnd);
    const selectionDirection = control.selectionDirection;
    const normalized = this.sanitize(raw);

    this.value = normalized;
    control.value = normalized;
    if (selectionStart !== null && selectionEnd !== null) {
      control.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
    }
    this.syncActiveSegmentFromSelection();
  }
  /** Clears the live code, returns focus to the field, and emits `lr-clear` when a value changed. */
  clear(): void {
    const hadValue = this.value.length > 0;
    this.value = '';
    if (this.control) this.control.value = '';
    this.focus();
    if (hadValue) this.emit('lr-clear');
  }

  override formResetCallback(): void {
    this.autosubmitToken += 1;
    super.formResetCallback();
    this.touched = false;
    this.segmentEditPendingChange = false;
  }

  override formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    this.autosubmitToken += 1;
    super.formStateRestoreCallback(state, reason);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.autosubmitToken += 1;
  }

  override reportValidity(): boolean {
    this.touched = true;
    return super.reportValidity();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Run after Lit has fully closed the first update. Focusing synchronously here relays the
    // native focus event and changes `focused`, which Lit correctly diagnoses as an update that
    // was scheduled from inside the update it just completed.
    if (this.autofocus) this.scheduleAfterUpdate(() => this.focus(), 'otp-autofocus');
  }

  override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // A narrower `type`/`case`/`length` must not leave a stale value that the same input could no
    // longer produce.
    if (changed.has('type') || changed.has('case') || changed.has('length') || changed.has('format')) {
      const next = this.sanitize(this.value);
      if (next !== this.value) this.value = next;
      else this.packSegmentValues(next);
    }
    if (
      changed.has('value') ||
      changed.has('required') ||
      changed.has('readonly') ||
      changed.has('length') ||
      changed.has('format')
    ) {
      this.updateValidity();
    }
    this.syncOtpStates();
  }

  private syncOtpStates(): void {
    setCustomState(this.internals, '--blank', this.value.length === 0);
    setCustomState(this.internals, '--filled', this.filledSegmentCount === this.renderedSegmentCount);
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
    setCustomState(this.internals, 'readonly', this.readonly);
  }

  /**
   * Recomputes the OTP-specific constraints. Barred controls short-circuit first, through the same
   * `isBarredFromValidation()` predicate the base mixin uses — this override used to check
   * `readonly` alone, so a `<lr-otp-input required disabled>` (or one inside a `<fieldset disabled>`)
   * still reported `valueMissing` and published `:state(invalid)`/`:state(user-invalid)`, which no
   * barred native control does.
   */
  private updateValidity(): void {
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    const total = this.renderedSegmentCount;
    const filled = this.filledSegmentCount;
    const complete = filled === total;
    if (this.required && filled === 0) {
      this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, this.localize('fieldRequired'));
      return;
    }
    if (filled > 0 && !complete) {
      this[SET_ANCHORED_VALIDITY]({ tooShort: true }, this.localize('otpInputIncomplete', undefined, { total }));
      return;
    }
    this[SET_ANCHORED_VALIDITY]({});
  }

  private onInput = (event: Event): void => {
    if ((event as Event & { isComposing?: unknown }).isComposing === true) {
      event.stopPropagation();
      return;
    }
    const raw = (event.target as HTMLInputElement).value;
    const next = this.sanitize(raw);
    const previous = this.value;
    const previousFilled = this.filledSegmentCount;
    const packed = Array.from({ length: this.renderedSegmentCount }, (_, index) => next[index] ?? '');
    const layoutChanged = packed.some((value, index) => value !== this.segmentValues[index]);
    // Keep the real input in step even when sanitizing rejected characters, or the caret walks
    // past text that was never accepted.
    if (this.control && this.control.value !== next) this.control.value = next;
    if (next === this.value && !layoutChanged) {
      event.stopImmediatePropagation();
      return;
    }
    this.touched = true;
    this.value = next;
    relayNativeEvent(this, event);
    if (previous && !next) this.emit('lr-clear');
    this.completeIfTransition(previousFilled);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const physical = event.key === 'ArrowRight' ? 1 : -1;
      const delta = this.effectiveDirection === 'rtl' ? -physical : physical;
      this.setActiveSegment(this.activeSegmentIndex + delta);
      return;
    }
    // Implicit form submission, through the shared `internal/submit-on-enter.ts` gate every other
    // text-bearing control routes through — so the modifier, IME-composition and already-vetoed
    // rules, and the submitter resolution, are one implementation rather than one per component.
    // The keystroke is deliberately not cancelled: the internal input has no form owner, so there
    // is no default action to cancel, and cancelling would suppress unrelated handlers downstream.
    if (event.key === 'Enter') {
      // `change` is normally deferred to blur, but an Enter that submits is a commit — the pending
      // change is flushed before the form reads the value, not after the submission or never.
      if (!this.readonly) submitOnEnter(this, event, { beforeSubmit: () => this.flushPendingChange() });
      return;
    }
    if (this.readonly || event.isComposing) return;
    const selection = this.selectedSegmentRange;
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      const values = this.normalizedSegmentValues();
      if (selection) {
        for (const index of selection.indices) values[index] = '';
        this.commitSegmentEdit(values, event.key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward');
        this.setActiveSegment(selection.first);
        return;
      }
      const changed = Boolean(values[this.activeSegmentIndex]);
      values[this.activeSegmentIndex] = '';
      if (changed) {
        this.commitSegmentEdit(values, event.key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward');
      }
      if (event.key === 'Backspace') this.setActiveSegment(this.activeSegmentIndex - 1);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    event.preventDefault();
    const accepted = this.sanitize(event.key).slice(0, 1);
    if (!accepted) return;
    const values = this.normalizedSegmentValues();
    const targetIndex = selection?.first ?? this.activeSegmentIndex;
    if (selection) {
      for (const index of selection.indices) values[index] = '';
    }
    values[targetIndex] = accepted;
    this.commitSegmentEdit(values, 'insertText', accepted);
    this.setActiveSegment(targetIndex + 1);
  };

  private onPaste = (event: ClipboardEvent): void => {
    if (this.effectiveDisabled || this.readonly) return;
    const pasted = this.sanitize(event.clipboardData?.getData('text') ?? '');
    event.preventDefault();
    if (!pasted) return;
    const values = Array.from({ length: this.renderedSegmentCount }, (_, index) => pasted[index] ?? '');
    this.commitSegmentEdit(values, 'insertFromPaste', pasted);
    this.setActiveSegment(Math.min(pasted.length, this.renderedSegmentCount - 1));
  };

  private onChange = (event: Event): void => {
    this.segmentEditPendingChange = false;
    relayNativeEvent(this, event);
  };

  private flushPendingChange(): void {
    if (!this.segmentEditPendingChange) return;
    this.segmentEditPendingChange = false;
    dispatchNativeEvent(this, 'change');
  }

  private onFocus = (event: FocusEvent): void => {
    this.focused = true;
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };
  private onBlur = (event: FocusEvent): void => {
    this.focused = false;
    // Disabling a focused native control blurs it as plain platform
    // behaviour (nothing custom-element-specific) — that forced blur is not a real user
    // interaction and must not flip `touched`, which could reenter an in-flight Lit update.
    if (!this.effectiveDisabled) this.touched = true;
    this.flushPendingChange();
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  private onLabelSlotChange = (event: Event): void => {
    this.hasLabelSlot = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
  };
  private onHintSlotChange = (event: Event): void => {
    this.hasHintSlot = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
  };
  private onErrorSlotChange = (event: Event): void => {
    this.hasErrorSlot = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
  };

  private renderSegment(index: number, invalid: boolean): TemplateResult {
    const char = this.segmentValues[index] ?? '';
    const filled = char !== '';
    const active = this.focused && !this.effectiveDisabled && !this.readonly && index === this.activeSegmentIndex;
    const masked = filled && this.mask;
    const placeholderMask = !filled && this.withMask;
    const parts = ['segment'];
    if (active) parts.push('active');
    if (masked) parts.push('masked');
    if (placeholderMask) parts.push('placeholder-mask');
    if (invalid) parts.push('invalid');
    // Presentational: the real <input> already carries the value for assistive technology, so
    // announcing each box again would read the code twice.
    return html`<div part=${parts.join(' ')} aria-hidden="true">${
      masked ? nothing : placeholderMask ? nothing : char
    }</div>`;
  }

  override render(): TemplateResult {
    const hasLabel = Boolean(this.label) || this.hasLabelSlot;
    const hasHint = Boolean(this.hint) || this.hasHintSlot;
    const hasError = Boolean(this.errorText) || this.hasErrorSlot;
    const intrinsicInvalid = this.touched && !this.validity.valid;
    const ariaInvalid = hasError || intrinsicInvalid;
    const describedBy = [hasError ? this.errorId : '', hasHint ? this.hintId : ''].filter(Boolean).join(' ');
    let segmentIndex = -1;

    return html`
      <div part="base form-control">
        <label part="label form-control-label" id=${this.labelId} for="control" ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" ?hidden=${Boolean(this.label)} @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div part="field segments" @click=${() => this.focus()}>
          ${this.cells.map((cell) =>
            cell.kind === 'separator'
              ? html`<div part="separator segment-literal" aria-hidden="true">${cell.text}</div>`
              : this.renderSegment((segmentIndex += 1), intrinsicInvalid)
          )}
          <input
            part="control"
            id="control"
            type="text"
            .value=${this.value}
            maxlength=${this.renderedSegmentCount}
            inputmode=${this.type === 'numeric' ? 'numeric' : 'text'}
            autocomplete=${this.autocomplete}
            ?autofocus=${this.autofocus}
            autocapitalize=${this.case === 'upper' ? 'characters' : 'off'}
            autocorrect="off"
            spellcheck="false"
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readonly}
            ?required=${this.required}
            aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.localize('otpInputLabel'))}
            aria-labelledby=${hasLabel && !this.getAttribute('aria-label') ? this.labelId : nothing}
            aria-describedby=${describedBy || nothing}
            aria-invalid=${ariaInvalid ? 'true' : 'false'}
            @input=${this.onInput}
            @change=${this.onChange}
            @keydown=${this.onKeyDown}
            @click=${this.syncActiveSegmentFromSelection}
            @keyup=${this.syncActiveSegmentFromSelection}
            @select=${this.syncActiveSegmentFromSelection}
            @paste=${this.onPaste}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          />
        </div>
        <div part="error" id=${this.errorId} ?hidden=${!hasError}>
          ${this.hasErrorSlot ? nothing : this.errorText}<slot
            name="error"
            ?hidden=${!this.hasErrorSlot}
            @slotchange=${this.onErrorSlotChange}
          ></slot>
        </div>
        <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" ?hidden=${Boolean(this.hint)} @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-otp-input': LyraOtpInput;
  }
}
