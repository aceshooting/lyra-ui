import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { nextId } from '../../../internal/a11y.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { styles } from './otp-input.styles.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';

/** Which characters a segment accepts. */
export type OtpInputType = 'numeric' | 'alpha' | 'alphanumeric';
/** Case transform applied as characters are entered. */
export type OtpInputCase = 'preserve' | 'upper' | 'lower';

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
  'lr-complete': CustomEvent<{ value: string }>;
}

class LyraOtpInputBase extends LyraElement<LyraOtpInputEventMap> {
  static override styles = [LyraElement.styles, styles];
}

/**
 * `<lr-otp-input>` — a form-associated one-time-code field: several character segments that
 * together hold one value.
 *
 * The segments are presentational. A single real `<input>` sits transparently across them and owns
 * focus, selection and the value, which is what makes paste, SMS autofill (`autocomplete` defaults
 * to `one-time-code`), IME composition and mobile keyboards work without reimplementing any of it —
 * and keeps the control to one tab stop rather than one per character.
 *
 * @customElement lr-otp-input
 * @slot label - Rich label content, replacing the `label` attribute.
 * @slot hint - Rich supporting text, replacing the `hint` attribute.
 * @slot error - Rich validation text, replacing the `errorText` attribute.
 * @event input - The value changed.
 * @event change - The value changed and the field settled.
 * @event focus - Native focus relayed once from the real input.
 * @event blur - Native blur relayed once from the real input.
 * @event lr-complete - Every segment is filled. `detail: { value }`.
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
 * @csspart base - The outer wrapper.
 * @csspart label - The field label.
 * @csspart field - The row of segments.
 * @csspart control - The real, visually transparent input.
 * @csspart segment - One character segment. Carries `active`, `masked`, `placeholder-mask` and
 * `invalid` in the part name so a consumer can target any of those states through `::part()`.
 * @csspart separator - A literal separator emitted by `format`.
 * @csspart hint - Supporting text.
 * @csspart error - Validation text.
 * @cssprop [--lr-otp-input-mask-char='•'] - The glyph shown for a masked character, and for every
 * empty segment while `with-mask` is set. Must be a quoted string, because it is used as CSS
 * `content`.
 */
export class LyraOtpInput extends FormAssociated(LyraOtpInputBase) {
  /** Visible label. Prefer the `label` slot for rich content. */
  @property() label = '';
  /** Supporting text below the field. */
  @property() hint = '';
  /** Validation text below the field. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Number of character segments. Ignored when `format` is set. */
  @property({ type: Number, reflect: true }) length = DEFAULT_LENGTH;
  /**
   * Segment layout with literal separators — `#` marks a segment, any other character becomes a
   * separator. `format="###-###"` renders two groups of three joined by a dash. Overrides `length`.
   */
  @property({ reflect: true }) format = '';
  /** Which characters are accepted; also drives the mobile keyboard through `inputmode`. */
  @property({ reflect: true }) type: OtpInputType = 'numeric';
  /** Case transform applied as characters are entered. */
  @property({ reflect: true }) case: OtpInputCase = 'preserve';
  /** Show entered characters as the mask glyph instead of their real value. Display-only. */
  @property({ type: Boolean, reflect: true }) mask = false;
  /**
   * Also show the mask glyph in empty segments, so the field reads as a fixed-length code before
   * any entry. Layers on top of `mask` — display-only, and inert on its own.
   */
  @property({ type: Boolean, reflect: true, attribute: 'with-mask' }) withMask = false;
  /** Display the value without allowing edits. Unlike `disabled`, it still submits and focuses. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Native autofill hint. Defaults to the SMS one-time-code value. */
  @property({ reflect: true }) autocomplete = 'one-time-code';

  @state() private focused = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  /** Validation text is only shown once the user has actually engaged with the field. */
  @state() private touched = false;

  @query('[part="control"]') private control!: HTMLInputElement;

  private readonly labelId = nextId('otp-input-label');
  private readonly hintId = nextId('otp-input-hint');
  private readonly errorId = nextId('otp-input-error');

  /** Segment count actually rendered: `format`'s `#` count when set, else `length`. */
  get segmentCount(): number {
    if (this.format) return Math.min(MAX_LENGTH, [...this.format].filter((c) => c === '#').length) || DEFAULT_LENGTH;
    return Math.min(MAX_LENGTH, Math.max(1, finiteInteger(this.length, DEFAULT_LENGTH)));
  }

  private get cells(): Cell[] {
    if (!this.format) return Array.from({ length: this.segmentCount }, () => ({ kind: 'segment' as const }));
    const out: Cell[] = [];
    let segments = 0;
    for (const char of this.format) {
      if (char === '#') {
        if (segments >= MAX_LENGTH) break;
        segments += 1;
        out.push({ kind: 'segment' });
      } else {
        out.push({ kind: 'separator', text: char });
      }
    }
    return out;
  }

  /** Drops characters the current `type` rejects, applies `case`, and truncates to the segment
   *  count — the single funnel every entry path (typing, paste, autofill, a `value` assignment)
   *  goes through, so none of them can produce a value the others could not. */
  private sanitize(raw: string): string {
    const accepted = ACCEPTED[this.type] ?? ACCEPTED.numeric;
    let out = [...(raw ?? '')].filter((char) => accepted.test(char)).join('');
    if (this.case === 'upper') out = out.toLocaleUpperCase(this.effectiveLocale);
    else if (this.case === 'lower') out = out.toLocaleLowerCase(this.effectiveLocale);
    return out.slice(0, this.segmentCount);
  }

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.control?.focus(options);
  }
  override blur(): void { this.control?.blur(); }
  override click(): void {
    if (!this.effectiveDisabled) this.control?.click();
  }
  /** Selects the whole code, mirroring `<input>.select()`. */
  select(): void { this.control?.select(); }

  override connectedCallback(): void {
    super.connectedCallback();
    this.value = this.sanitize(this.value);
    this.updateValidity();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate?.(changed);
    // A narrower `type`/`case`/`length` must not leave a stale value that the same input could no
    // longer produce.
    if (changed.has('type') || changed.has('case') || changed.has('length') || changed.has('format')) {
      const next = this.sanitize(this.value);
      if (next !== this.value) this.value = next;
    }
    if (changed.has('value') || changed.has('required') || changed.has('length') || changed.has('format')) {
      this.updateValidity();
    }
  }

  private updateValidity(): void {
    const total = this.segmentCount;
    const complete = this.value.length === total;
    if (this.required && this.value.length === 0) {
      this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, this.localize('fieldRequired'));
      return;
    }
    if (this.value.length > 0 && !complete) {
      this[SET_ANCHORED_VALIDITY]({ tooShort: true }, this.localize('otpInputIncomplete', undefined, { total }));
      return;
    }
    this[SET_ANCHORED_VALIDITY]({});
  }

  private onInput = (event: Event): void => {
    const raw = (event.target as HTMLInputElement).value;
    const next = this.sanitize(raw);
    // Keep the real input in step even when sanitizing rejected characters, or the caret walks
    // past text that was never accepted.
    if (this.control && this.control.value !== next) this.control.value = next;
    if (next === this.value) {
      event.stopImmediatePropagation();
      return;
    }
    this.touched = true;
    this.value = next;
    relayNativeEvent(this, event);
    if (next.length === this.segmentCount) this.emit('lr-complete', { value: next });
  };

  private onChange = (event: Event): void => {
    relayNativeEvent(this, event);
  };

  private onFocus = (event: FocusEvent): void => {
    this.focused = true;
    relayNativeEvent(this, event);
  };
  private onBlur = (event: FocusEvent): void => {
    this.focused = false;
    this.touched = true;
    relayNativeEvent(this, event);
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
    const char = this.value[index] ?? '';
    const filled = char !== '';
    const active = this.focused && !this.effectiveDisabled && !this.readonly
      && index === Math.min(this.value.length, this.segmentCount - 1);
    const masked = filled && this.mask;
    const placeholderMask = !filled && this.mask && this.withMask;
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
    const invalid = this.touched && !this.validity.valid;
    const describedBy = [hasError ? this.errorId : '', hasHint ? this.hintId : ''].filter(Boolean).join(' ');
    let segmentIndex = -1;

    return html`
      <div part="base">
        <label part="label" id=${this.labelId} for="control" ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div part="field" @click=${() => this.focus()}>
          ${this.cells.map((cell) =>
            cell.kind === 'separator'
              ? html`<div part="separator" aria-hidden="true">${cell.text}</div>`
              : this.renderSegment((segmentIndex += 1), invalid),
          )}
          <input
            part="control"
            id="control"
            type="text"
            .value=${this.value}
            maxlength=${this.segmentCount}
            inputmode=${this.type === 'numeric' ? 'numeric' : 'text'}
            autocomplete=${this.autocomplete}
            autocapitalize=${this.case === 'upper' ? 'characters' : 'off'}
            autocorrect="off"
            spellcheck="false"
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readonly}
            ?required=${this.required}
            aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.localize('otpInputLabel'))}
            aria-labelledby=${hasLabel && !this.getAttribute('aria-label') ? this.labelId : nothing}
            aria-describedby=${describedBy || nothing}
            aria-invalid=${invalid ? 'true' : 'false'}
            @input=${this.onInput}
            @change=${this.onChange}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          />
        </div>
        <div part="error" id=${this.errorId} ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-otp-input': LyraOtpInput; } }
