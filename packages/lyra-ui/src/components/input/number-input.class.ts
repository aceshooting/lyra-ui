import { LyraInput } from './input.class.js';

/**
 * `<lyra-number-input>` — a numeric-input alias with the complete `lyra-input`
 * form, validation, and native editing contract.
 *
 * @customElement lyra-number-input
 */
export class LyraNumberInput extends LyraInput {
  constructor() {
    super();
    this.type = 'number';
  }
  connectedCallback(): void {
    super.connectedCallback();
    this.type = 'number';
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-number-input': LyraNumberInput; } }
