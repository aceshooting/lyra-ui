import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './model-settings-panel.styles.js';
import type { LyraModelCatalog } from '../model-select/model-select.js';
import '../model-select/model-select.js';
import '../slider/slider.js';

export type ModelSettingsPanelLayout = 'vertical' | 'compact';

/** The full current settings shape, re-emitted on every `lyra-change`
 *  regardless of which child control actually triggered it. */
export interface ModelSettingsChangeDetail {
  modelValue: string;
  inCatalog: boolean;
  temperature: number;
}

const DEFAULT_TEMPERATURE_MIN = 0;
const DEFAULT_TEMPERATURE_MAX = 2;
const DEFAULT_TEMPERATURE_STEP = 0.1;
// Midpoint of the default [0, 2] range -- a reasonable provider-agnostic
// starting point. Reassign `temperature` yourself if your provider's own
// default differs (OpenAI and Anthropic both default to 1, which this matches).
const DEFAULT_TEMPERATURE = 1;

/**
 * `<lyra-model-settings-panel>` — a fixed composition of `<lyra-model-select>`
 * and `<lyra-slider>` into one agent-configuration card: pick a provider's
 * model, then tune its sampling temperature. Not a generic layout shell (no
 * slots) — it exists so a consumer doesn't have to re-wire the same two
 * child `lyra-change` events into one combined settings object by hand every
 * time this pairing comes up.
 *
 * Every prop here is a plain pass-through to (or mirror of) the matching
 * child control's own prop of the same/similar name; see the child
 * components themselves for the exact semantics of `catalog`/`allowCustom`
 * and `temperatureMin`/`temperatureMax`/`temperatureStep`.
 *
 * @customElement lyra-model-settings-panel
 * @event lyra-change - Either child control changed. `detail: { modelValue: string; inCatalog: boolean; temperature: number }` — always the full current settings, not just whatever changed.
 * @csspart base - The outermost wrapping container.
 * @csspart model-row - The row wrapping the internal `lyra-model-select`.
 * @csspart temperature-row - The row wrapping the temperature label/slider/value.
 * @csspart temperature-label - The visible "Temperature" caption.
 * @csspart temperature-value - The visible current temperature readout.
 */
export class LyraModelSettingsPanel extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Informational provider badge, passed straight through to the internal `lyra-model-select`. */
  @property() provider = '';
  /** The model list, passed straight through to the internal `lyra-model-select`. */
  @property({ attribute: false }) catalog?: LyraModelCatalog;
  /** The current model id. */
  @property({ attribute: 'model-value' }) modelValue = '';
  /** Let the model control accept a value outside `catalog`; passed straight through. */
  @property({ type: Boolean, attribute: 'allow-custom' }) allowCustom = false;
  /** The current sampling temperature. */
  @property({ type: Number }) temperature = DEFAULT_TEMPERATURE;
  @property({ type: Number, attribute: 'temperature-min' }) temperatureMin = DEFAULT_TEMPERATURE_MIN;
  @property({ type: Number, attribute: 'temperature-max' }) temperatureMax = DEFAULT_TEMPERATURE_MAX;
  @property({ type: Number, attribute: 'temperature-step' }) temperatureStep = DEFAULT_TEMPERATURE_STEP;
  /** `vertical` stacks full-width rows with visible labels; `compact` runs
   *  the same two rows side by side with a smaller temperature caption, for
   *  toolbars/sidebars where the vertical layout's height doesn't fit. */
  @property({ reflect: true }) layout: ModelSettingsPanelLayout = 'vertical';

  /** Whether `modelValue` is present in `catalog` — recomputed fresh from
   *  scratch (like `lyra-model-select`'s own `effectiveEntries`) rather than
   *  cached from the last child event, so it's still correct when
   *  `modelValue` was assigned directly instead of via the child's own
   *  `lyra-change`. */
  private get inCatalog(): boolean {
    const catalog = this.catalog;
    if (!catalog || catalog.length === 0) return false;
    return catalog.some((entry) => (typeof entry === 'string' ? entry === this.modelValue : entry.id === this.modelValue));
  }

  private emitChange(): void {
    this.emit<ModelSettingsChangeDetail>('lyra-change', {
      modelValue: this.modelValue,
      inCatalog: this.inCatalog,
      temperature: this.temperature,
    });
  }

  private onModelChange = (e: CustomEvent<{ value: string; inCatalog: boolean }>): void => {
    this.modelValue = e.detail.value;
    this.emitChange();
  };

  private onTemperatureChange = (e: CustomEvent<{ value: number }>): void => {
    this.temperature = e.detail.value;
    this.emitChange();
  };

  render(): TemplateResult {
    return html`
      <div part="base">
        <div part="model-row">
          <lyra-model-select
            .provider=${this.provider}
            .catalog=${this.catalog}
            .value=${this.modelValue}
            .allowCustom=${this.allowCustom}
            placeholder="Select a model…"
            @lyra-change=${this.onModelChange}
          ></lyra-model-select>
        </div>
        <div part="temperature-row">
          <span part="temperature-label">Temperature</span>
          <lyra-slider
            .label=${'Temperature'}
            .min=${this.temperatureMin}
            .max=${this.temperatureMax}
            .step=${this.temperatureStep}
            .valueAsNumber=${this.temperature}
            .showValue=${false}
            @lyra-change=${this.onTemperatureChange}
          ></lyra-slider>
          <span part="temperature-value">${this.temperature}</span>
        </div>
      </div>
    `;
  }
}

defineElement('model-settings-panel', LyraModelSettingsPanel);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-model-settings-panel': LyraModelSettingsPanel;
  }
}
