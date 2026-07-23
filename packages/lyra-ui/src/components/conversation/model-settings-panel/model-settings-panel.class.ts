import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber, finiteRange, decimalPlaces } from '../../../internal/numbers.js';
import { styles } from './model-settings-panel.styles.js';
import type { LyraModelCatalog } from '../model-select/model-select.class.js';
import '../model-select/model-select.class.js';
import '../../forms/slider/slider.class.js';

export type ModelSettingsPanelLayout = 'vertical' | 'compact';

/** The full current settings shape, re-emitted on every `lr-change`
 *  regardless of which child control actually triggered it. */
export interface ModelSettingsChangeDetail {
  modelValue: string;
  inCatalog: boolean;
  temperature: number;
}

export interface LyraModelSettingsPanelEventMap {
  'lr-change': CustomEvent<ModelSettingsChangeDetail>;
}

const DEFAULT_TEMPERATURE_MIN = 0;
const DEFAULT_TEMPERATURE_MAX = 2;
const DEFAULT_TEMPERATURE_STEP = 0.1;
// Midpoint of the default [0, 2] range -- a reasonable provider-agnostic
// starting point. Reassign `temperature` yourself if your provider's own
// default differs (OpenAI and Anthropic both default to 1, which this matches).
const DEFAULT_TEMPERATURE = 1;

/**
 * `<lr-model-settings-panel>` — a fixed composition of `<lr-model-select>`
 * and `<lr-slider>` into one agent-configuration card: pick a provider's
 * model, then tune its sampling temperature. Not a generic layout shell (no
 * slots) — it exists so a consumer doesn't have to re-wire the same two
 * child `lr-change` events into one combined settings object by hand every
 * time this pairing comes up.
 *
 * Every prop here is a plain pass-through to (or mirror of) the matching
 * child control's own prop of the same/similar name; see the child
 * components themselves for the exact semantics of `catalog`/`allowCustom`
 * and `temperatureMin`/`temperatureMax`/`temperatureStep`.
 *
 * The panel's own `temperature` readout mirrors the slider's *live* value —
 * updated on every `lr-input` (drag/key-repeat), not just the committed
 * `lr-change` — and is re-clamped into `[temperatureMin, temperatureMax]`
 * (snapped to `temperatureStep`) whenever those three properties change, so
 * it can never drift from what the nested `lr-slider` itself shows.
 *
 * @customElement lr-model-settings-panel
 * @event lr-change - Either child control changed. `detail: { modelValue: string; inCatalog: boolean; temperature: number }` — always the full current settings, not just whatever changed.
 * @csspart base - The outermost wrapping container.
 * @csspart model-row - The row wrapping the internal `lr-model-select`.
 * @csspart temperature-row - The row wrapping the temperature label/slider/value.
 * @csspart temperature-label - The visible "Temperature" caption.
 * @csspart temperature-value - The visible current temperature readout.
 */
export class LyraModelSettingsPanel extends LyraElement<LyraModelSettingsPanelEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Informational provider badge, passed straight through to the internal `lr-model-select`. */
  @property() provider = '';
  /** The model list, passed straight through to the internal `lr-model-select`. */
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
  /** Disables the panel as a unit by forwarding to both the internal
   *  `lr-model-select` and `lr-slider` — a wrapping `<fieldset disabled>`
   *  alone would not reach either, since a form-associated control's own
   *  `disabled` IDL property/attribute is never mutated by fieldset cascading. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Whether `modelValue` is present in `catalog` — recomputed fresh from
   *  scratch (like `lr-model-select`'s own `effectiveEntries`) rather than
   *  cached from the last child event, so it's still correct when
   *  `modelValue` was assigned directly instead of via the child's own
   *  `lr-change`. */
  private get inCatalog(): boolean {
    const catalog = this.catalog;
    if (!catalog || catalog.length === 0) return false;
    return catalog.some((entry) => (typeof entry === 'string' ? entry === this.modelValue : entry.id === this.modelValue));
  }

  /** Clamps `raw` into `[temperatureMin, temperatureMax]`, snapped to
   *  `temperatureStep`'s grid anchored at the low end -- exactly mirroring
   *  `lr-slider`'s own private `clampValue`/`domain` math -- so the
   *  mirrored `temperature` readout can never disagree with what the nested
   *  slider itself would clamp the same raw number to. */
  private clampTemperature(raw: number): number {
    const rawMin = this.temperatureMin;
    const rawMax = this.temperatureMax;
    const min = finiteNumber(rawMin, DEFAULT_TEMPERATURE_MIN);
    const max = finiteNumber(rawMax, DEFAULT_TEMPERATURE_MAX);
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const step = finiteRange(this.temperatureStep, 0, 0);
    const hasStep = step > 0;
    let stepped = finiteNumber(raw, lo);
    if (hasStep) {
      const stepsFromLo = Math.round((raw - lo) / step);
      const factor = 10 ** decimalPlaces(step);
      stepped = Math.round((lo + stepsFromLo * step) * factor) / factor;
    }
    return Math.min(hi, Math.max(lo, stepped));
  }

  private emitChange(): void {
    this.emit<ModelSettingsChangeDetail>('lr-change', {
      modelValue: this.modelValue,
      inCatalog: this.inCatalog,
      temperature: this.temperature,
    });
  }

  private onModelChange = (e: CustomEvent<{ value: string; inCatalog: boolean }>): void => {
    e.stopPropagation();
    this.modelValue = e.detail.value;
    this.emitChange();
  };

  private onTemperatureChange = (e: CustomEvent<{ value: number }>): void => {
    e.stopPropagation();
    this.temperature = e.detail.value;
    this.emitChange();
  };

  /** Mirrors the slider's *live* (uncommitted) value into the panel's own
   *  `temperature` readout -- display only, no `emitChange()` -- mirroring
   *  native `input` (continuous) vs. `change` (committed) semantics so the
   *  readout tracks an in-progress drag/key-repeat instead of only updating
   *  once the interaction commits. */
  private onTemperatureInput = (e: CustomEvent<{ value: number }>): void => {
    this.temperature = e.detail.value;
  };

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('temperatureMin') || changed.has('temperatureMax') || changed.has('temperatureStep')) {
      const clamped = this.clampTemperature(this.temperature);
      if (clamped !== this.temperature) this.temperature = clamped;
    }
  }

  override render(): TemplateResult {
    const temperatureLabel = this.localize('temperature');
    return html`
      <div part="base">
        <div part="model-row">
          <lr-model-select
            .provider=${this.provider}
            .catalog=${this.catalog}
            .value=${this.modelValue}
            .allowCustom=${this.allowCustom}
            .disabled=${this.disabled}
            placeholder=${this.localize('selectModel')}
            @lr-change=${this.onModelChange}
          ></lr-model-select>
        </div>
        <div part="temperature-row">
          <span part="temperature-label">${temperatureLabel}</span>
          <lr-slider
            .label=${temperatureLabel}
            .min=${this.temperatureMin}
            .max=${this.temperatureMax}
            .step=${this.temperatureStep}
            .valueAsNumber=${this.temperature}
            .showValue=${false}
            .disabled=${this.disabled}
            @lr-input=${this.onTemperatureInput}
            @lr-change=${this.onTemperatureChange}
          ></lr-slider>
          <span part="temperature-value" aria-hidden="true">${this.temperature}</span>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-model-settings-panel': LyraModelSettingsPanel;
  }
}
