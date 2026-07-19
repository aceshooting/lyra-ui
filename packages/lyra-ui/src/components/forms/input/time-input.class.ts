import { property } from 'lit/decorators.js';
import { LyraInput } from './input.class.js';

/**
 * Keeps a time-shaped bound (`09:00`, `09:00:30`) exactly as authored. `lr-input` declares
 * `min`/`max` as `type: Number` for its `type="number"` contract, which would turn any time
 * literal into `NaN` — and a `NaN` `min`/`max` reaches the native `<input type="time">` as the
 * meaningless string `"NaN"`, which the browser discards, so the bound silently disappears.
 * A missing attribute still yields `undefined`, so nothing is forwarded at all.
 */
const timeBoundConverter = {
  fromAttribute: (value: string | null): string | undefined => value ?? undefined,
  toAttribute: (value: string | number | undefined): string | null => (value == null ? null : String(value)),
};

/**
 * `<lr-time-input>` — a native time-input alias with Lyra form chrome and events.
 *
 * Adds no API of its own beyond re-typing the inherited `min`/`max` bounds for time values; every
 * other property, event, slot and part is `<lr-input>`'s.
 *
 * @customElement lr-time-input
 */
export class LyraTimeInput extends LyraInput {
  /** Earliest selectable time, as the native `<input type="time">` spells it (`HH:MM`, or
   *  `HH:MM:SS` alongside a seconds-precision `step`). Forwarded verbatim to that native input,
   *  whose own constraint validation reports `rangeUnderflow`. Defaults to `undefined` (no lower
   *  bound). Unlike `<lr-input type="number">`'s numeric `min`, the attribute form is *not*
   *  parsed as a number. */
  @property({ converter: timeBoundConverter }) min?: string | number;
  /** Latest selectable time, in the same form as `min`, reported by the native input as
   *  `rangeOverflow`. Defaults to `undefined` (no upper bound). */
  @property({ converter: timeBoundConverter }) max?: string | number;

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
