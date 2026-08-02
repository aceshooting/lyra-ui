import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { nextId } from '../../../internal/a11y.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { contextualSizes } from '../../../internal/contextual-vocabulary.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import { styles } from './otp-input.styles.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';

/** Which characters a segment accepts. */
export type OtpInputType = 'numeric' | 'alpha' | 'alphanumeric';
/** Case transform applied as characters are entered. */
export type OtpInputCase = 'preserve' | 'upper' | 'lower';
/** Segment fill treatment, including the OTP-specific joined `contained` treatment. */
export type OtpInputAppearance =
  | Extract<LyraAppearance, 'outlined' | 'filled' | 'filled-outlined'>
  | 'contained';

const ACCEPTED: Record<OtpInputType, RegExp> = {
  numeric: /[0-9]/,
  alpha: /[a-zA-Z]/,
  alphanumeric: /[a-zA-Z0-9]/,
};

const DEFAULT_LENGTH = 6;
// A guard, not a design limit: `length` reaches a template repeat and a `maxlength`, so an absurd
// value from an attribute would render an absurd number of nodes.
const MAX_LENGTH = 32;

/** One rendered cell: either an entry segment or a literal separator from `format`. */
type Cell = { kind: 'segment' } | { kind: 'separator'; text: string };

export interface LyraOtpInputEventMap {
  input: InputEvent;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
  'lr-clear': CustomEvent<undefined>;
  'lr-invalid': CustomEvent<undefined>;
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
 * Delete clears it in place, and neither deletion shifts trailing characters. Enter requests one
 * submission from the owning form. A full paste into an empty field fills accepted characters from
 * the first cell in one input operation. The public/submitted string concatenates occupied cells;
 * middle empty cells are a visual editing state and are not encoded in that string. A nonempty
 * native selection maps its compact offsets back to occupied cells for replacement or deletion.
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
 * @event lr-invalid - The one-time-code input failed a validity check.
 * @event lr-complete - The field transitions from incomplete to every segment filled.
 * `detail: { value }`. Cancelable; preventing it suppresses `autosubmit` for that completion.
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
 * @status stable
 * @since 8.0.0
 */
export class LyraOtpInput extends FormAssociated(LyraOtpInputBase) {
  /** Visible label. When nonempty, it takes precedence over rich `label`-slot content. */
  @property() label = '';
  /** Supporting text below the field. When nonempty, it takes precedence over the `hint` slot. */
  @property() hint = '';
  /** Validation text shown immediately below the field. It sets the internal input's ARIA invalid
   *  state; rich `error`-slot content takes precedence when supplied. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Visual fill treatment for each segment, or a single joined `contained` field. */
  @property({ reflect: true }) appearance: OtpInputAppearance = 'outlined';
  /** Automatically focus the real input after the first client render. */
  @property({ type: Boolean }) override autofocus = false;
  /** Submit the owning form after an un-canceled `lr-complete`. */
  @property({ type: Boolean, reflect: true }) autosubmit = false;
  /** Segment size on the shared form-control ladder. An unset size inherits its containing context;
   *  standalone rendering falls back to `m`. */
  @property({ reflect: true, useDefault: true }) size: LyraSize = 'm';
  /** Number of character segments. Ignored when `format` is set. */
  @property({ type: Number, reflect: true }) length = DEFAULT_LENGTH;
  /**
   * Segment layout with literal separators — `#` marks a segment, any other character becomes a
   * separator. `format="###-###"` renders two groups of three joined by a dash. Overrides `length`
   * when it contains at least one `#`; a malformed literal-only format falls back to `length`.
   */
  @property() format = '';
  /** Which characters are accepted; also drives the mobile keyboard through `inputmode`. */
  @property({ reflect: true }) type: OtpInputType = 'numeric';
  /** Case transform applied as characters are entered. */
  @property({ reflect: true }) case: OtpInputCase = 'preserve';
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
  @property({ reflect: true }) autocomplete = 'one-time-code';

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

  /** Live value normalized through the same character/length contract as native editing. */
  override get value(): string {
    return super.value;
  }

  override set value(next: string | null) {
    const normalized = this.sanitize(next ?? '');
    this.packSegmentValues(normalized);
    super.value = normalized;
  }

  /** Parses at most 32 segments and coalesces every literal run into one cell, so even an
   * adversarially long format cannot manufacture an unbounded number of template nodes. */
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
    for (const char of this.format) {
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
  get segmentCount(): number {
    const formatted = this.formattedCells;
    if (formatted) return formatted.filter((cell) => cell.kind === 'segment').length;
    return Math.min(MAX_LENGTH, Math.max(1, finiteInteger(this.length, DEFAULT_LENGTH)));
  }

  /** Mapped read-only name for the number of segments derived from `format` or `length`. */
  get effectiveLength(): number {
    return this.segmentCount;
  }

  private get cells(): Cell[] {
    return this.formattedCells ??
      Array.from({ length: this.segmentCount }, () => ({ kind: 'segment' as const }));
  }

  /** Drops characters the current `type` rejects, applies `case`, and truncates to the segment
   *  count — the single funnel every live path (native editing, programmatic value/default writes,
   *  reset, and browser restoration) goes through. */
  private sanitize(raw: string): string {
    const accepted = ACCEPTED[this.type] ?? ACCEPTED.numeric;
    let out = [...(raw ?? '')].filter((char) => accepted.test(char)).join('');
    // The declared alpha vocabulary is ASCII. Locale-sensitive Turkish casing would turn i/I into
    // İ/ı, producing characters the same sanitizer says are not accepted.
    if (this.case === 'upper') out = out.toUpperCase();
    else if (this.case === 'lower') out = out.toLowerCase();
    return out.slice(0, this.segmentCount);
  }

  private packSegmentValues(value: string): void {
    const count = this.segmentCount;
    this.segmentValues = Array.from({ length: count }, (_, index) => value[index] ?? '');
    this.activeSegmentIndex = Math.min(value.length, count - 1);
  }

  private get filledSegmentCount(): number {
    if (!Array.isArray(this.segmentValues)) return this.value.length;
    return this.segmentValues.reduce((count, value) => count + (value ? 1 : 0), 0);
  }

  private normalizedSegmentValues(values = this.segmentValues): string[] {
    return Array.from({ length: this.segmentCount }, (_, index) => values[index] ?? '');
  }

  private setActiveSegment(index: number): void {
    const next = Math.min(this.segmentCount - 1, Math.max(0, index));
    this.activeSegmentIndex = next;
    const caret = this.normalizedSegmentValues().slice(0, next).filter(Boolean).length;
    this.control?.setSelectionRange(caret, caret);
    void this.updateComplete.then(() => {
      const segment = this.renderRoot.querySelectorAll<HTMLElement>('[part~="segment"]')[next];
      segment?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  private completeIfTransition(previousFilled: number): void {
    if (previousFilled >= this.segmentCount || this.filledSegmentCount !== this.segmentCount) return;
    const completeEvent = this.emit('lr-complete', { value: this.value }, { cancelable: true });
    if (this.autosubmit && !completeEvent.defaultPrevented) this.getForm()?.requestSubmit();
  }

  private commitSegmentEdit(
    values: string[],
    inputType: string,
    data: string | null = null,
  ): void {
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
  private get selectedSegmentRange(): { indices: number[]; first: number } | null {
    const start = this.control?.selectionStart;
    const end = this.control?.selectionEnd;
    if (start === undefined || start === null || end === undefined || end === null || start === end) {
      return null;
    }
    const occupiedIndices = this.normalizedSegmentValues()
      .map((value, index) => value ? index : -1)
      .filter((index) => index >= 0);
    const indices = occupiedIndices.slice(start, end);
    const first = indices[0];
    return first === undefined ? null : { indices, first };
  }

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.control?.focus(options);
  }
  override blur(): void { this.control?.blur(); }
  override click(): void {
    if (!this.effectiveDisabled) this.control?.click();
  }
  /** Selects the whole compact code. Fixed-cell typing or deletion honors the selected range. */
  select(): void { this.control?.select(); }
  /** Clears the live code, returns focus to the field, and emits `lr-clear` when a value changed. */
  clear(): void {
    const hadValue = this.value.length > 0;
    this.value = '';
    if (this.control) this.control.value = '';
    this.focus();
    if (hadValue) this.emit('lr-clear');
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
    this.segmentEditPendingChange = false;
  }

  override reportValidity(): boolean {
    this.touched = true;
    return super.reportValidity();
  }

  protected override firstUpdated(): void {
    // Run after Lit has fully closed the first update. Focusing synchronously here relays the
    // native focus event and changes `focused`, which Lit correctly diagnoses as an update that
    // was scheduled from inside the update it just completed.
    if (this.autofocus) this.scheduleAfterUpdate(() => this.focus(), 'otp-autofocus');
  }

  override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate?.(changed);
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
    setCustomState(this.internals, '--filled', this.filledSegmentCount === this.segmentCount);
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
    setCustomState(this.internals, 'readonly', this.readonly);
  }

  private updateValidity(): void {
    const total = this.segmentCount;
    const filled = this.filledSegmentCount;
    const complete = filled === total;
    if (this.readonly) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
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
    if (event instanceof InputEvent && event.isComposing) {
      event.stopPropagation();
      return;
    }
    const raw = (event.target as HTMLInputElement).value;
    const next = this.sanitize(raw);
    const previous = this.value;
    const previousFilled = this.filledSegmentCount;
    const packed = Array.from({ length: this.segmentCount }, (_, index) => next[index] ?? '');
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
    if (event.key === 'Enter') {
      event.preventDefault();
      this.flushPendingChange();
      this.getForm()?.requestSubmit();
      return;
    }
    if (this.readonly || event.isComposing) return;
    const selection = this.selectedSegmentRange;
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      const values = this.normalizedSegmentValues();
      if (selection) {
        for (const index of selection.indices) values[index] = '';
        this.commitSegmentEdit(
          values,
          event.key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward',
        );
        this.setActiveSegment(selection.first);
        return;
      }
      const changed = Boolean(values[this.activeSegmentIndex]);
      values[this.activeSegmentIndex] = '';
      if (changed) {
        this.commitSegmentEdit(
          values,
          event.key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward',
        );
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
    const values = Array.from({ length: this.segmentCount }, (_, index) => pasted[index] ?? '');
    this.commitSegmentEdit(values, 'insertFromPaste', pasted);
    this.setActiveSegment(Math.min(pasted.length, this.segmentCount - 1));
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
    this.touched = true;
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
    const active = this.focused && !this.effectiveDisabled && !this.readonly
      && index === this.activeSegmentIndex;
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
          ${this.label}<slot
            name="label"
            ?hidden=${Boolean(this.label)}
            @slotchange=${this.onLabelSlotChange}
          ></slot>
        </label>
        <div part="field segments" @click=${() => this.focus()}>
          ${this.cells.map((cell) =>
            cell.kind === 'separator'
              ? html`<div part="separator segment-literal" aria-hidden="true">${cell.text}</div>`
              : this.renderSegment((segmentIndex += 1), intrinsicInvalid),
          )}
          <input
            part="control"
            id="control"
            type="text"
            .value=${this.value}
            maxlength=${this.segmentCount}
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
          ${this.hint}<slot
            name="hint"
            ?hidden=${Boolean(this.hint)}
            @slotchange=${this.onHintSlotChange}
          ></slot>
        </div>
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-otp-input': LyraOtpInput; } }
