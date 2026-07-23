import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { lengthViolations } from '../../../internal/length-constraints.js';
import { styles } from './textarea.styles.js';
import { spellcheckConverter } from '../../../internal/converters.js';

export type TextareaResize = 'none' | 'vertical' | 'both' | 'auto';
export type TextareaWrap = 'hard' | 'soft' | 'off';
export type TextareaSelectionDirection = 'forward' | 'backward' | 'none';

/** Enumerated (not boolean-presence) attribute parsing for `spellcheck`, matching the native HTML
 *  `spellcheck` attribute's own true/false/empty/inherit semantics -- Lit's built-in `type:
 *  Boolean` converts based on attribute *presence*, which would treat a literal
 *  `spellcheck="false"` as truthy (the attribute is present) instead of `false`. */

export interface LyraTextareaEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
class LyraTextareaBase extends LyraElement<LyraTextareaEventMap> {}

/**
 * `<lr-textarea>` — a multiline plain-text input primitive, form-associated via the
 * `FormAssociated` mixin (see `<lr-chat-composer>`/`<lr-date-input>` for the same shape), so it
 * participates in native `<form>` submission/validation/reset like any other text control --
 * `name`/`value`/`disabled`/`required`/`checkValidity()`/`reportValidity()` all come from that mixin.
 *
 * Ships an opt-in `label`/`hint`/`errorText` form-control chrome (props + matching named slots +
 * `form-control-label`/`hint`/`error` parts), mirroring `<lr-select>`'s exact pattern -- left
 * unset, the chrome remains hidden. A consumer preferring their own form-field layout can still
 * ignore these and wrap the element. A host `aria-label` is forwarded to the internal textbox;
 * external `aria-labelledby`/`aria-describedby` idrefs are not copied across the shadow boundary.
 *
 * `minlength`/`maxlength` are forwarded to the internal native `<textarea>` and bridged into this
 * element's own `ElementInternals` as `tooShort`/`tooLong` by `updateValidity()`.
 *
 * @customElement lr-textarea
 * @event input - Native-style composed event fired on every user-driven edit.
 * @event change - Native-style composed event fired at the native `change` timing.
 * @event lr-input - Compatibility alias for `input`; `detail: { value }`.
 * @event lr-change - Compatibility alias for `change`; `detail: { value }`.
 * @event blur - Re-dispatched from the internal native `<textarea>`'s own `blur` -- bubbling and
 *   composed (unlike the native event, which is neither), so a listener above the shadow boundary
 *   can observe it.
 * @event focus - Re-dispatched from the internal native `<textarea>`'s own `focus`, for the same
 *   reason as `blur`.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @csspart form-control - The outer wrapper around label, textarea, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart textarea - The native `<textarea>` element.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-textarea-max-block-size=none] - Maximum auto-grown block size before the textarea scrolls.
 */
export class LyraTextarea extends FormAssociated(LyraTextareaBase) {
  static override styles = [LyraElement.styles, styles];

  /** Visible text rows. */
  // numeric-guard-exempt: forwarded only to the native <textarea rows> attribute (see the
  // template below) -- the browser's own "rules for parsing non-negative integers" fall back to
  // its default for an invalid value instead of throwing, and this file performs no arithmetic on
  // `rows` itself (fitToContent() measures the live DOM scrollHeight, not this property).
  @property({ type: Number }) rows = 3;
  /** Native CSS `resize` behavior for the textarea, plus `'auto'`: a `ResizeObserver`-driven
   *  grow-to-content mode with no manual drag handle (mirrors `wa-textarea`'s `resize="auto"`). */
  @property() resize: TextareaResize = 'vertical';
  @property() placeholder = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** Accessible name overriding the label/placeholder-derived default. Takes precedence over both
   *  `label` and `placeholder` when set, matching `<lr-date-input>`'s `accessibleLabel`. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Forwarded to the native `<textarea>`'s own `spellcheck`. Defaults to `true`, matching the
   *  native element's own default. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the native `<textarea>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = '';
  /** Forwarded to the native `<textarea>`'s own `autocorrect` (Safari/WebKit-specific). Empty
   *  string omits the attribute (browser default). */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  /** Forwarded to the native `<textarea>`'s own `wrap`. */
  @property() wrap: TextareaWrap = 'soft';
  /** Native editing-assistance attributes forwarded to the wrapped textarea. Empty strings omit
   *  the corresponding attribute and retain the browser default. */
  @property() autocomplete = '';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Minimum text length, forwarded to the native `<textarea>`'s own `minlength` and reported as
   *  `tooShort` by `updateValidity()`. Defaults to `undefined` (no lower bound). Like native
   *  `minlength`, an empty value never violates it — pair it with `required` to also reject
   *  empty. */
  // numeric-guard-exempt: forwarded to the native <textarea minlength> attribute, which applies
  // the platform's "rules for parsing non-negative integers" (an unparseable value is ignored,
  // not thrown on); the same rule gates lengthViolations() before it is used in any comparison.
  @property({ type: Number }) minlength?: number;
  /** Upper counterpart of `minlength` (native `maxlength`/`tooLong`), with the same parsing and
   *  the same default of `undefined`. Note that native `maxlength` also *prevents* typing beyond
   *  the limit; it reports `tooLong` for values that arrive some other way (paste of a longer
   *  value, a programmatic assignment). */
  // numeric-guard-exempt: same rationale as `minlength` above, for the native <textarea maxlength>
  // attribute and ValidityState.tooLong.
  @property({ type: Number }) maxlength?: number;

  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private touched = false;

  @query('textarea') private textareaEl?: HTMLTextAreaElement;
  private resizeObserver?: ResizeObserver;
  private lastObservedWidth?: number;
  private resizeRaf?: number;

  constructor() {
    super();
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
  }

  /** The internal native `<textarea>` element, for direct DOM access (caret position, selection,
   *  `setRangeText()`) that has no first-class `lr-*` equivalent -- mirrors `wa-textarea`'s own
   *  `input` getter. */
  get input(): HTMLTextAreaElement | null {
    return this.textareaEl ?? null;
  }

  get selectionStart(): number | null {
    return this.textareaEl?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.textareaEl) this.textareaEl.selectionStart = value ?? 0;
  }

  get selectionEnd(): number | null {
    return this.textareaEl?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.textareaEl) this.textareaEl.selectionEnd = value ?? 0;
  }

  get selectionDirection(): TextareaSelectionDirection | null {
    return this.textareaEl?.selectionDirection as TextareaSelectionDirection | null;
  }

  set selectionDirection(value: TextareaSelectionDirection | null) {
    if (this.textareaEl) this.textareaEl.selectionDirection = value ?? 'none';
  }

  override focus(options?: FocusOptions): void {
    this.textareaEl?.focus(options);
  }

  override blur(): void {
    this.textareaEl?.blur();
  }

  select(): void {
    this.textareaEl?.select();
  }

  setSelectionRange(start: number | null, end: number | null, direction?: TextareaSelectionDirection): void {
    this.textareaEl?.setSelectionRange(start, end, direction);
  }

  /** Passthrough to the native `<textarea>`'s `setRangeText()`. Mirrors `wa-textarea`'s own method
   *  of the same name/signature. No-op if the element hasn't rendered yet. */
  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    const ta = this.textareaEl;
    if (!ta) return;
    if (start === undefined || end === undefined) {
      ta.setRangeText(replacement);
    } else {
      ta.setRangeText(replacement, start, end, selectMode);
    }
    this.value = ta.value;
    this.fitToContent();
  }

  protected override willUpdate(changed: PropertyValues): void {
    // A future mixin layered under LyraTextarea (beyond FormAssociated, which defines no
    // willUpdate of its own today) would otherwise silently never run -- mirrors this same file's
    // updated() override, which already calls super.updated(changed) for the identical reason.
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-drop reparent, a repeat() re-key, or a tab panel detaching and
    // reattaching its content) leaves resizeObserver undefined from disconnectedCallback's own
    // teardown below -- Lit's connectedCallback doesn't schedule a re-render on its own, so
    // without this, auto-grow would only come back once some unrelated reactive property
    // happened to change, and a pure container-width resize landing before that would be missed.
    if (this.resize === 'auto' && this.hasUpdated) {
      this.armResizeObserver();
      this.fitToContent();
    }
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.resizeRaf !== undefined) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = undefined;
    super.disconnectedCallback();
  }

  /**
   * Bridges the internal native `<textarea>`'s own browser-computed constraint validation into
   * this element's `ElementInternals`, mirroring `<lr-input>`'s override of the same name. Without
   * it this control falls through to the base mixin's plain required-and-empty check, which leaves
   * `minlength`/`maxlength` enforced while typing but absent from `validity`.
   *
   * `required` is evaluated here rather than read back off the native element's own `valueMissing`,
   * for two reasons: the `required` attribute reaches that element only on Lit's next render (so a
   * same-tick `el.required = true` would be answered from a stale attribute), and this path owns
   * the localized `fieldRequired` message the base mixin already produced.
   *
   * The native `tooShort`/`tooLong` flags are raised only for a value the *user* edited, so an
   * over-length value assigned from script would report valid. `lengthViolations()` recomputes
   * both from `value` and they are OR-ed into the native flags (see
   * `internal/length-constraints.ts`).
   */
  protected updateValidity(): void {
    if (this.required && this.value === '') {
      this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, this.localize('fieldRequired'));
      return;
    }
    const native = this.textareaEl;
    if (native && native.value !== this.value) native.value = this.value;
    const own = lengthViolations(this.value, this.minlength, this.maxlength);
    const tooShort = Boolean(native?.validity.tooShort) || own.tooShort;
    const tooLong = Boolean(native?.validity.tooLong) || own.tooLong;
    if (!tooShort && !tooLong) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    this[SET_ANCHORED_VALIDITY](
      { tooShort, tooLong },
      // Empty exactly when the native textarea itself sees nothing wrong, i.e. when only the
      // dirty-value supplement above fired — the browser has no message for a value it considers
      // valid, so fall back to the localized generic one.
      native?.validationMessage || this.localize('valueInvalid'),
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // A constraint that tightens without a value write (`el.maxlength = 3` over an existing value)
    // reaches the native textarea only on this render, so validity has to be recomputed after it.
    if (changed.has('minlength') || changed.has('maxlength')) this.updateValidity();
    if (changed.has('resize')) {
      if (this.resize === 'auto') {
        this.armResizeObserver();
      } else if (changed.get('resize') === 'auto') {
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        if (this.textareaEl) {
          this.textareaEl.style.blockSize = '';
          this.textareaEl.style.overflowY = '';
        }
      }
    }
    if (this.resize === 'auto') {
      this.armResizeObserver();
      if (changed.has('value') || changed.has('rows') || changed.has('resize')) this.fitToContent();
    }
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  private armResizeObserver(): void {
    const textarea = this.textareaEl;
    if (this.resizeObserver || !textarea) return;
    this.lastObservedWidth = textarea.getBoundingClientRect().width;
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      // fitToContent() itself writes a *block*-size (height) change to the observed element,
      // which would otherwise re-trigger this same observer every tick -- only re-fit when the
      // *inline* size (width) actually changed, mirroring lr-chat-composer's identical
      // armTextareaResizeObserver() guard.
      if (
        width === undefined ||
        (this.lastObservedWidth !== undefined && Math.abs(width - this.lastObservedWidth) < 0.5)
      ) {
        return;
      }
      this.lastObservedWidth = width;
      if (this.resizeRaf !== undefined) cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = undefined;
        this.fitToContent();
      });
    });
    this.resizeObserver.observe(textarea);
  }

  private fitToContent(): void {
    const ta = this.textareaEl;
    if (!ta || this.resize !== 'auto') return;
    // Collapse first so a shrinking edit (e.g. deleting a wrapped line) can shrink the box back
    // down too, not just grow it -- scrollHeight never reports smaller than the box's current
    // height otherwise.
    ta.style.blockSize = 'auto';
    const computed = getComputedStyle(ta);
    const borderBlock = parseFloat(computed.borderBlockStartWidth) + parseFloat(computed.borderBlockEndWidth);
    const parsedMax = parseFloat(computed.maxBlockSize);
    const maxBlockSize = Number.isFinite(parsedMax) ? parsedMax : Number.POSITIVE_INFINITY;
    const contentBlockSize = ta.scrollHeight + borderBlock;
    ta.style.blockSize = `${Math.min(contentBlockSize, maxBlockSize)}px`;
    ta.style.overflowY = contentBlockSize > maxBlockSize ? 'auto' : 'hidden';
  }

  private onInput = (): void => {
    if (!this.textareaEl) return;
    this.value = this.textareaEl.value;
    if (this.resize === 'auto') this.fitToContent();
    this.emit('input');
    this.emit('lr-input', { value: this.value });
  };

  private onChange = (): void => {
    if (!this.textareaEl) return;
    this.value = this.textareaEl.value;
    this.emit('change');
    this.emit('lr-change', { value: this.value });
  };

  private onFocus = (): void => {
    this.emit('focus');
  };

  private onBlur = (): void => {
    this.touched = true;
    this.emit('blur');
  };

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  override render(): TemplateResult {
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const describedBy = [hasError ? 'textarea-error' : '', hasHint ? 'textarea-hint' : '']
      .filter(Boolean)
      .join(' ');
    // resize="auto" grows via JS (fitToContent()); the native CSS resize property stays 'none' so
    // there's no manual drag handle fighting the automatic sizing, matching wa-textarea.
    const cssResize = this.resize === 'auto' ? 'none' : this.resize;
    return html`
      <div part="form-control">
        <label part="form-control-label" for="textarea" ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <textarea
          id="textarea"
          part="textarea"
          rows=${this.rows}
          placeholder=${this.placeholder}
          style=${`resize:${cssResize}`}
          ?data-auto-resize=${this.resize === 'auto'}
          aria-label=${this.accessibleLabel ||
          (hasLabel ? nothing : this.placeholder || this.localize('textareaLabel'))}
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${hasError || (this.touched && !this.internals.validity.valid) ? 'true' : 'false'}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.autoCorrect || nothing}
          autocomplete=${this.autocomplete || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          minlength=${this.minlength ?? nothing}
          maxlength=${this.maxlength ?? nothing}
          wrap=${this.wrap}
          .value=${this.value}
          ?required=${this.required}
          ?disabled=${this.effectiveDisabled}
          @input=${this.onInput}
          @change=${this.onChange}
          @focus=${this.onFocus}
          @blur=${this.onBlur}
        ></textarea>
        <div id="textarea-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="textarea-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-textarea': LyraTextarea;
  }
}
