import { property } from 'lit/decorators.js';
import { LyraInput } from './input.class.js';
import type { LyraAppearance } from '../../../internal/variants.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_restore, LYRA_DEFAULT_search } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const timeBoundConverter = {
  fromAttribute: (value: string | null): string | undefined => value ?? undefined,
  toAttribute: (value: string | number | undefined): string | null => (value == null ? null : String(value)),
};

/**
 * `<lr-native-time-input>` — the browser-native time field preserved from Lyra 7.
 *
 * Use this control when the platform's own `input[type=time]` UI is preferred. The segmented,
 * locale-aware Web Awesome-compatible field is `<lr-time-input>`.
 *
 * @customElement lr-native-time-input
 * @csspart base - Compatibility name for the control row; use `time-input`.
 * @csspart time-input - The native time control row. It is the same node as `base` and the
 *   inherited `input-wrapper` part.
 * @status stable
 * @since 8.0.0
 */
export class LyraNativeTimeInput extends LyraInput {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Lyra 7 visual default retained intentionally while the mapped `lr-input` default moves to
   * outlined in v8. */
  @property({ reflect: true }) override appearance: LyraAppearance = 'filled-outlined';

  protected override get inputWrapperParts(): string {
    return `${super.inputWrapperParts} time-input`;
  }

  /** Earliest selectable native time. */
  @property({ converter: timeBoundConverter }) override min?: string | number;
  /** Latest selectable native time. */
  @property({ converter: timeBoundConverter }) override max?: string | number;

  constructor() {
    super();
    this.type = 'time';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.type = 'time';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-native-time-input': LyraNativeTimeInput;
  }
}
