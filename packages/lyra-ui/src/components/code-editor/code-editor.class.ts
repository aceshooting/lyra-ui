import { html, nothing, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { styles } from './code-editor.styles.js';

export interface LyraCodeEditorEventMap { input: CustomEvent<{ value: string }>; change: CustomEvent<{ value: string }>; blur: CustomEvent<undefined>; focus: CustomEvent<undefined>; }
class LyraCodeEditorBase extends LyraElement<LyraCodeEditorEventMap> {}

/** `<lyra-code-editor>` — dependency-free multiline code editing surface with optional line numbers.
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
  @property({ type: Number, attribute: 'tab-size' }) tabSize = 2;
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
  private onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Tab' && !this.readonly) { event.preventDefault(); const target = event.target as HTMLTextAreaElement; const start = target.selectionStart; target.setRangeText(' '.repeat(Math.max(1, this.tabSize)), start, target.selectionEnd, 'end'); this.value = target.value; this.emit('input', { value: this.value }); } };
  protected updated(): void { if (this.textarea && this.textarea.value !== this.value) this.textarea.value = this.value; }
  render(): TemplateResult {
    const lineCount = Math.max(1, this.value.split('\n').length);
    const label = this.accessibleLabel || this.label || this.localize('codeEditorLabel');
    return html`<div part="form-control">
      <label part="label" for="textarea" ?hidden=${!this.label}>${this.label}<slot name="label"></slot>${this.required ? html`<span aria-hidden="true">*</span>` : nothing}</label>
      <div part="editor" data-language=${this.language}>
        ${this.lineNumbers ? html`<div part="gutter" aria-hidden="true">${Array.from({ length: lineCount }, (_v, i) => html`<div>${i + 1}</div>`)}</div>` : nothing}
        <textarea id="textarea" part="textarea" .value=${this.value} aria-label=${label} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'} placeholder=${this.placeholder} ?readonly=${this.readonly} ?disabled=${this.effectiveDisabled} spellcheck=${this.spellcheck} autocapitalize=${this.autocapitalize} autocorrect=${this.autoCorrect} wrap=${this.wrap} style=${`resize:${this.resize};tab-size:${this.tabSize}`} @input=${this.onInput} @change=${this.onChange} @keydown=${this.onKeyDown} @focus=${this.onFocus} @blur=${this.onBlur}></textarea>
      </div>
      <div part="hint" ?hidden=${!this.hint}>${this.hint}</div><div part="error" ?hidden=${!this.errorText}>${this.errorText}</div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-code-editor': LyraCodeEditor; } }
