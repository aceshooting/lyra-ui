import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { styles } from './textarea.styles.js';

export type TextareaResize = 'none' | 'vertical' | 'both';

export interface LyraTextareaEventMap {
  'lyra-input': CustomEvent<{ value: string }>;
  'lyra-change': CustomEvent<{ value: string }>;
}
class LyraTextareaBase extends LyraElement<LyraTextareaEventMap> {}

/**
 * `<lyra-textarea>` — a bare, multiline plain-text input primitive. Form-associated via the
 * `FormAssociated` mixin (see `<lyra-chat-composer>`/`<lyra-date-input>` for the same shape), so it
 * participates in native `<form>` submission/validation/reset like any other text control --
 * `name`/`value`/`disabled`/`required`/`checkValidity()`/`reportValidity()` all come from that mixin.
 *
 * Deliberately no auto-resize and no label/hint/error chrome -- the thin `lyra-*` equivalent of a
 * plain `wa-textarea`, not a rebuild of `<lyra-chat-composer>`. A consumer wanting a labeled field
 * wraps this element in whatever form-field layout it already uses.
 *
 * @customElement lyra-textarea
 * @event lyra-input - Fired on every user-driven edit (not a programmatic `.value` assignment). `detail: { value }`.
 * @event lyra-change - Fired on the native `change` timing (control loses focus after a committed edit). `detail: { value }`.
 * @csspart textarea - The native `<textarea>` element.
 */
export class LyraTextarea extends FormAssociated(LyraTextareaBase) {
  static styles = [LyraElement.styles, styles];

  /** Visible text rows. */
  @property({ type: Number }) rows = 3;
  /** Native CSS `resize` behavior for the textarea. */
  @property() resize: TextareaResize = 'vertical';
  @property() placeholder = '';

  @query('textarea') private textareaEl?: HTMLTextAreaElement;

  private onInput = (): void => {
    if (!this.textareaEl) return;
    this.value = this.textareaEl.value;
    this.emit('lyra-input', { value: this.value });
  };

  private onChange = (): void => {
    if (!this.textareaEl) return;
    this.value = this.textareaEl.value;
    this.emit('lyra-change', { value: this.value });
  };

  render(): TemplateResult {
    return html`
      <textarea
        part="textarea"
        rows=${this.rows}
        placeholder=${this.placeholder}
        style=${`resize:${this.resize}`}
        aria-label=${this.placeholder || this.localize('textareaLabel')}
        .value=${this.value}
        ?required=${this.required}
        ?disabled=${this.effectiveDisabled}
        @input=${this.onInput}
        @change=${this.onChange}
      ></textarea>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-textarea': LyraTextarea;
  }
}
