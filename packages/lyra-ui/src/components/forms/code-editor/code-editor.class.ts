import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { styles } from './code-editor.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';

export interface LyraCodeEditorEventMap { input: CustomEvent<{ value: string }>; change: CustomEvent<{ value: string }>; blur: CustomEvent<undefined>; focus: CustomEvent<undefined>; }
class LyraCodeEditorBase extends LyraElement<LyraCodeEditorEventMap> {}

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once the property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead (mirrors `lr-task-list`'s `expanded`
 *  converter). `toAttribute` reflects the `true` state as a present attribute rather than omitting
 *  it, matching this property's own `reflect: true`. */

/** `<lr-code-editor>` — dependency-free multiline code editing surface with optional line numbers.
 *
 * Keyboard contract (no keyboard trap, WCAG 2.1.2): Tab inserts one indent unit of spaces at the
 * caret. Shift+Tab is never captured, so it always performs native reverse focus traversal.
 * Pressing Escape releases the next Tab for native forward traversal instead of indenting; typing
 * any other key, or focus leaving the editor, re-arms Tab indentation.
 *
 * Tab-width precedence, highest first: an explicitly assigned `tabSize` (property or `tab-size`
 * attribute) wins over everything; otherwise a host-level `--lr-code-editor-tab-size` override
 * wins; otherwise the stylesheet's `:host` default of `2` applies. The property therefore stays the
 * primary knob, but it no longer silently shadows the token while it sits at its default -- see
 * `indentWidth` for how the same order drives the Tab key, not just the rendered tab stops.
 * @customElement lr-code-editor
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @event input - User edited the code.
 * @event change - Native change timing.
 * @csspart form-control - Outer wrapper.
 * @csspart form-control-label - Label. Also carries the `label` part token for compatibility.
 * @csspart label - Alias of `form-control-label`.
 * @csspart editor - Editor frame.
 * @csspart gutter - Line-number gutter.
 * @csspart textarea - Native textarea.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-code-editor-min-block-size=var(--lr-size-8rem)] - Minimum block size of the editor frame and its textarea.
 * @cssprop [--lr-code-editor-line-height=1.5] - Line height shared by the gutter and the textarea, so line numbers stay aligned with their lines.
 * @cssprop [--lr-code-editor-tab-size=2] - The textarea's `tab-size`. The single channel for tab width — the class writes this token rather than setting `tab-size` directly.
 */
export class LyraCodeEditor extends FormAssociated(LyraCodeEditorBase) {
  static override styles = [LyraElement.styles, styles];
  @property() language = '';
  @property({ converter: trueDefaultBooleanConverter, reflect: true, attribute: 'line-numbers' }) lineNumbers = true;

  private _tabSize = 2;
  private tabSizeAssigned = false;
  /** Spaces inserted per Tab keypress, and the rendered `tab-size`. Assigning it (or setting the
   *  `tab-size` attribute) pins both, overriding any `--lr-code-editor-tab-size` the host set;
   *  leaving it alone lets that token drive them instead. Confirmed-crash history: this used to
   *  feed `' '.repeat(Math.max(1, this.tabSize))` directly in `onKeyDown` below --
   *  `String.prototype.repeat()` throws a `RangeError` for a count of `+Infinity` specifically
   *  (e.g. a literal `tab-size="Infinity"` attribute, which `Number("Infinity")` happily converts
   *  to), and `Math.max(1, NaN)` is itself `NaN`, silently producing an empty, non-indenting insert
   *  for a NaN `tabSize`. Sanitized to a finite integer in `[1, 16]` at assignment time instead, so
   *  both the `repeat()` call and the emitted tab-width style always see a safe value. */
  @property({ type: Number, attribute: 'tab-size' })
  get tabSize(): number {
    return this._tabSize;
  }
  set tabSize(value: number) {
    const old = this._tabSize;
    // Removing the `tab-size` attribute hands Lit's Number converter a `null`: treat that as "back
    // to unset" so the token regains control rather than staying pinned to the sanitized fallback.
    this.tabSizeAssigned = (value as number | null) != null;
    this._tabSize = finiteInteger(value, 2, 1, 16);
    this.requestUpdate('tabSize', old);
  }
  /** Spaces a Tab press inserts, resolved with the documented precedence: an explicitly assigned
   *  `tabSize`, else the rendered `--lr-code-editor-tab-size` when it is a plain number, else the
   *  default. A length-valued token (`40px`, `2ch`, ...) is a purely visual tab-stop metric for
   *  literal tab characters, so it is deliberately not reinterpreted as a count of spaces. */
  private get indentWidth(): number {
    if (this.tabSizeAssigned || !this.textarea) return this._tabSize;
    const resolved = getComputedStyle(this.textarea).tabSize.trim();
    if (!/^\d+(?:\.\d+)?$/.test(resolved)) return this._tabSize;
    return finiteInteger(Number(resolved), this._tabSize, 1, 16);
  }

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property() resize: 'none' | 'both' | 'horizontal' | 'vertical' = 'both';
  @property({ attribute: 'wrap' }) wrap: 'off' | 'soft' | 'hard' = 'off';
  @property({ converter: { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => value ? 'true' : 'false' } }) override spellcheck = false;
  @property() override autocapitalize = 'off';
  @property({ attribute: 'autocorrect' }) autoCorrect = 'off';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @query('textarea') private textarea?: HTMLTextAreaElement;
  override click(): void { if (!this.effectiveDisabled) this.textarea?.click(); }
  override focus(options?: FocusOptions): void { this.textarea?.focus(options); }
  override blur(): void { this.textarea?.blur(); }
  select(): void { this.textarea?.select(); }
  get selectionStart(): number { return this.textarea?.selectionStart ?? 0; }
  set selectionStart(value: number) { if (this.textarea) this.textarea.selectionStart = value; }
  get selectionEnd(): number { return this.textarea?.selectionEnd ?? 0; }
  set selectionEnd(value: number) { if (this.textarea) this.textarea.selectionEnd = value; }
  get selectionDirection(): 'forward' | 'backward' | 'none' {
    return this.textarea?.selectionDirection ?? 'none';
  }
  set selectionDirection(value: 'forward' | 'backward' | 'none') {
    if (this.textarea) this.textarea.selectionDirection = value;
  }
  setSelectionRange(start: number, end: number, direction?: 'forward' | 'backward' | 'none'): void { this.textarea?.setSelectionRange(start, end, direction); }
  setRangeText(replacement: string, start?: number, end?: number, selectionMode?: SelectionMode): void {
    const textarea = this.textarea;
    if (!textarea) return;
    textarea.setRangeText(replacement, start ?? textarea.selectionStart, end ?? textarea.selectionEnd, selectionMode);
    this.value = textarea.value;
  }
  private onInput = (event: Event): void => { this.value = (event.target as HTMLTextAreaElement).value; this.emit('input', { value: this.value }); };
  private onChange = (): void => { this.emit('change', { value: this.value }); };
  private onFocus = (): void => { this.emit('focus'); };
  private onBlur = (): void => { this.touched = true; this.tabBypassArmed = false; this.emit('blur'); };
  private tabBypassArmed = false;
  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { this.tabBypassArmed = true; return; }
    if (event.key === 'Tab') {
      if (event.shiftKey) return;
      if (this.tabBypassArmed) { this.tabBypassArmed = false; return; }
      if (this.readonly) return;
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      target.setRangeText(' '.repeat(this.indentWidth), start, target.selectionEnd, 'end');
      this.value = target.value;
      this.emit('input', { value: this.value });
      return;
    }
    this.tabBypassArmed = false;
  };
  private onLabelSlotChange = (e: Event): void => { this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onHintSlotChange = (e: Event): void => { this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onErrorSlotChange = (e: Event): void => { this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.textarea && this.textarea.value !== this.value) this.textarea.value = this.value;
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }
  override render(): TemplateResult {
    const lineCount = Math.max(1, this.value.split('\n').length);
    // Write the token, not `tab-size` itself: the stylesheet's `tab-size: var(--lr-code-editor-tab-size)`
    // resolves it, so an untouched `tabSize` leaves a host-level override of that token in charge
    // instead of being overwritten by an inline declaration on every update.
    const tabWidthStyle = this.tabSizeAssigned ? `;--lr-code-editor-tab-size:${this._tabSize}` : '';
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'textarea-error' : '', hasHint ? 'textarea-hint' : ''].filter(Boolean).join(' ');
    const label = this.accessibleLabel || (hasLabel ? nothing : this.localize('codeEditorLabel'));
    return html`<div part="form-control">
      <label part="label form-control-label" for="textarea" ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</label>
      <div part="editor" data-language=${this.language}>
        ${this.lineNumbers
          ? html`<div part="gutter" aria-hidden="true">${lineCount <= 1_000
              ? Array.from({ length: lineCount }, (_v, i) => html`<div>${i + 1}</div>`)
              : html`<span>${Array.from({ length: lineCount }, (_v, i) => i + 1).join('\n')}</span>`}</div>`
          : nothing}
        <textarea id="textarea" part="textarea" .value=${this.value} aria-label=${label} aria-describedby=${describedBy || nothing} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'} placeholder=${this.placeholder} ?readonly=${this.readonly} ?disabled=${this.effectiveDisabled} spellcheck=${this.spellcheck} autocapitalize=${this.autocapitalize} autocorrect=${this.autoCorrect} wrap=${this.wrap} style=${`resize:${this.resize}${tabWidthStyle}`} @input=${this.onInput} @change=${this.onChange} @keydown=${this.onKeyDown} @focus=${this.onFocus} @blur=${this.onBlur}></textarea>
      </div>
      <div id="textarea-hint" part="hint" ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot></div>
      <div id="textarea-error" part="error" ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-code-editor': LyraCodeEditor; } }
