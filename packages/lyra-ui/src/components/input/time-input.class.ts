import { LyraInput } from './input.class.js';

/**
 * `<lyra-time-input>` — a native time-input alias with Lyra form chrome and events.
 *
 * @customElement lyra-time-input
 */
export class LyraTimeInput extends LyraInput {
  constructor() {
    super();
    this.type = 'time';
  }
  connectedCallback(): void {
    super.connectedCallback();
    this.type = 'time';
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-time-input': LyraTimeInput; } }
