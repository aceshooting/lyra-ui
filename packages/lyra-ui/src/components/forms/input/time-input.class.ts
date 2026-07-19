import { LyraInput } from './input.class.js';

/**
 * `<lr-time-input>` — a native time-input alias with Lyra form chrome and events.
 *
 * @customElement lr-time-input
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
declare global { interface HTMLElementTagNameMap { 'lr-time-input': LyraTimeInput; } }
