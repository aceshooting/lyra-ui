import { LyraInput } from './input.class.js';

/**
 * `<lr-number-input>` — a numeric-input alias with the complete `lr-input`
 * form, validation, and native editing contract.
 *
 * @customElement lr-number-input
 */
export class LyraNumberInput extends LyraInput {
  constructor() {
    super();
    this.type = 'number';
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.type = 'number';
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-number-input': LyraNumberInput; } }
