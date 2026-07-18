import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { finiteInteger } from '../../internal/numbers.js';
import { styles } from './code-editor.styles.js';

export interface LyraCodeEditorEventMap { input: CustomEvent<{ value: string }>; change: CustomEvent<{ value: string }>; blur: CustomEvent<undefined>; focus: CustomEvent<undefined>; }
class LyraCodeEditorBase extends LyraElement<LyraCodeEditorEventMap> {}

/** `<lyra-code-editor>` — dependency-free multiline code editing surface with optional line numbers.
 *
 * Keyboard contract (no keyboard trap, WCAG 2.1.2): Tab inserts `tabSize` spaces at the caret.
 * Shift+Tab is never captured, so it always performs native reverse focus traversal. Pressing
 * Escape releases the next Tab for native forward traversal instead of indenting; typing any other
 * key, or focus leaving the editor, re-arms Tab indentation.
 * @customElement lyra-code-editor
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @event input - User edited the code.
 * @event change - Native change timing.
 * @csspart form-control - Outer wrapper.
 * @csspart label - Label.
 * @csspart editor - Editor frame.
 * @csspart gutter - Line-number gutter.
 * @csspart textarea - Native textarea.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 */
export class LyraCodeEditor extends FormAssociated(LyraCodeEditorBase) {
  static styles = [LyraElement.styles, styles];
  @property() language = '';
  @property({ type: Boolean, reflect: true, attribute: 'line-numbers' }) lineNumbers = true;

  private _tabSize = 2;
  /** Spaces inserted per Tab keypress, and the native `tab-size` CSS value. Confirmed-crash
   *  history: this used to feed `' '.repeat(Math.max(1, this.tabSize))` directly in `onKeyDown`
   *  below -- `String.prototype.repeat()` throws a `RangeError` for a count of `+Infinity`
   *  specifically (e.g. a literal `tab-size="Infinity"` attribute, which `Number("Infinity")`
   *  happily converts to), and `Math.max(1, NaN)` is itself `NaN`, silently producing an empty,
   *  non-indenting insert for a NaN `tabSize`. Sanitized to a finite integer in `[1, 16]` at
   *  assignment time instead, so both the `repeat()` call and the inline `tab-size` style always
   *  see a safe value. */
  @property({ type: Number, attribute: 'tab-size' })
  get tabSize(): number {
    return this._tabSize;
  }
  set tabSize(value: number) {
    const old = this._tabSize;
    this._tabSize = finiteInteger(value, 2, 1, 16);
    this.requestUpdate('tabSize', old);
  }

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property() resize: 'none' | 'both' | 'horizontal' | 'vertical' = 'both';
  @property({ attribute: 'wrap' }) wrap: 'off' | 'soft' | 'hard' = 'off';
  @property({ converter: { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => value ? 'true' : 'false' } }) spellcheck = false;
  @property() autocapitalize = 'off';
  @property({ attribute: 'autocorrect' }) autoCorrect = 'off';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @query('textarea') private textarea?: HTMLTextAreaElement;
  override focus(options?: FocusOptions): void { this.textarea?.focus(options); }
  override blur(): void { this.textarea?.blur(); }
  select(): void { this.textarea?.select(); }
  get selectionStart(): number { return this.textarea?.selectionStart ?? 0; }
  get selectionEnd(): number { return this.textarea?.selectionEnd ?? 0; }
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
  private onBlur = (): void => { this.touched = true; this.emit('blur'); };
  private onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Tab' && !this.readonly) { event.preventDefault(); const target = event.target as HTMLTextAreaElement; const start = target.selectionStart; target.setRangeText(' '.repeat(this.tabSize), start, target.selectionEnd, 'end'); this.value = target.value; this.emit('input', { value: this.value }); } };
  private onLabelSlotChange = (e: Event): void => { this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onHintSlotChange = (e: Event): void => { this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onErrorSlotChange = (e: Event): void => { this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }
  protected updated(changed: PropertyValues): void {
    if (this.textarea && this.textarea.value !== this.value) this.textarea.value = this.value;
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }
  render(): TemplateResult {
    const lineCount = Math.max(1, this.value.split('\n').length);
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'textarea-error' : '', hasHint ? 'textarea-hint' : ''].filter(Boolean).join(' ');
    const label = this.accessibleLabel || (hasLabel ? nothing : this.localize('codeEditorLabel'));
    return html`<div part="form-control">
      <label part="label" for="textarea" ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</label>
      <div part="editor" data-language=${this.language}>
        ${this.lineNumbers ? html`<div part="gutter" aria-hidden="true">${Array.from({ length: lineCount }, (_v, i) => html`<div>${i + 1}</div>`)}</div>` : nothing}
        <textarea id="textarea" part="textarea" .value=${this.value} aria-label=${label} aria-describedby=${describedBy || nothing} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'} placeholder=${this.placeholder} ?readonly=${this.readonly} ?disabled=${this.effectiveDisabled} spellcheck=${this.spellcheck} autocapitalize=${this.autocapitalize} autocorrect=${this.autoCorrect} wrap=${this.wrap} style=${`resize:${this.resize};tab-size:${this.tabSize}`} @input=${this.onInput} @change=${this.onChange} @keydown=${this.onKeyDown} @focus=${this.onFocus} @blur=${this.onBlur}></textarea>
      </div>
      <div id="textarea-hint" part="hint" ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot></div>
      <div id="textarea-error" part="error" ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-code-editor': LyraCodeEditor; } }
