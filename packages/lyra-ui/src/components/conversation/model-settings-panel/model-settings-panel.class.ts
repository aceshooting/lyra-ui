import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { normalizeCatalog } from '../../../internal/catalog-picker.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRange, decimalPlaces } from '../../../internal/numbers.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { styles } from './model-settings-panel.styles.js';
import type { LyraCatalog, LyraModelCatalogEntry } from '../model-select/model-select.class.js';
import '../model-select/model-select.class.js';
import '../../forms/slider/slider.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_model, LYRA_DEFAULT_selectModel, LYRA_DEFAULT_temperature } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ModelSettingsPanelLayout = 'vertical' | 'compact';

const MODEL_SETTINGS_PANEL_LAYOUT = literalSetConverter<ModelSettingsPanelLayout>(
  ['vertical', 'compact'],
  'vertical',
);

/** The full current settings shape, re-emitted on every `lr-change`
 *  regardless of which child control actually triggered it. */
export interface ModelSettingsChangeDetail {
  model: string;
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
 * Array-valued catalogs are clone-owned, bounded readonly snapshots. Create and reassign a new
 * catalog array after changing its rows.
 *
 * The panel's own `temperature` readout mirrors the slider's *live* value —
 * updated on every `lr-input` (drag/key-repeat), not just the committed
 * `lr-change` — and is re-clamped into `[temperatureMin, temperatureMax]`
 * (snapped to `temperatureStep`) whenever those three properties change, so
 * it can never drift from what the nested `lr-slider` itself shows.
 * The visible temperature readout uses the effective locale and switches to bounded scientific
 * notation when a full decimal expansion would disturb the layout. The slider retains the exact
 * finite value through `aria-valuenow`.
 *
 * @customElement lr-model-settings-panel
 * @event lr-change - Either child control changed. `detail: { model: string; inCatalog: boolean; temperature: number }` — always the full current settings, not just whatever changed.
 * @csspart base - The outermost wrapping container.
 * @csspart model-row - The row wrapping the internal `lr-model-select`.
 * @csspart model-select - The internal model selector.
 * @csspart model-label - The model selector's visible label.
 * @csspart temperature-row - The row wrapping the temperature label/slider/value.
 * @csspart temperature-label - The visible "Temperature" caption.
 * @csspart temperature-value - The visible current temperature readout.
 * @status stable
 * @since 4.0.0
 */
export class LyraModelSettingsPanel extends LyraElement<LyraModelSettingsPanelEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['catalog']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    model: LYRA_DEFAULT_model,
    selectModel: LYRA_DEFAULT_selectModel,
    temperature: LYRA_DEFAULT_temperature,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Informational provider badge, passed straight through to the internal `lr-model-select`. */
  @property() provider = '';
  /** The clone-owned model list, normalized to unique nonempty first-wins ids by the internal
   *  `lr-model-select` and by this panel's `inCatalog` event computation. Reassign a new array
   *  after changes. */
  @property({ attribute: false }) catalog?: LyraCatalog<LyraModelCatalogEntry>;
  /** The current model id. */
  @property() model = '';
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
  private _layout: ModelSettingsPanelLayout = 'vertical';

  @property({ reflect: true, converter: MODEL_SETTINGS_PANEL_LAYOUT })
  get layout(): ModelSettingsPanelLayout {
    return this._layout;
  }
  set layout(next: ModelSettingsPanelLayout) {
    const normalized = MODEL_SETTINGS_PANEL_LAYOUT.normalizeReflected(this, 'layout', next);
    const old = this._layout;
    if (old === normalized) return;
    this._layout = normalized;
    this.requestUpdate('layout', old);
  }
  /** Disables the panel as a unit by forwarding to both the internal
   *  `lr-model-select` and `lr-slider` — a wrapping `<fieldset disabled>`
   *  alone would not reach either, since a form-associated control's own
   *  `disabled` IDL property/attribute is never mutated by fieldset cascading. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Whether `model` is present in `catalog` — recomputed fresh from
   *  scratch (like `lr-model-select`'s own `effectiveEntries`) rather than
   *  cached from the last child event, so it's still correct when
   *  `model` was assigned directly instead of via the child's own
   *  `lr-change`. */
  private get inCatalog(): boolean {
    return normalizeCatalog<LyraModelCatalogEntry>(this.catalog).some((entry) => entry.id === this.model);
  }

  private get temperatureDomain(): { min: number; max: number; lo: number; hi: number; step: number } {
    const min = finiteNumber(this.temperatureMin, DEFAULT_TEMPERATURE_MIN);
    const max = finiteNumber(this.temperatureMax, DEFAULT_TEMPERATURE_MAX);
    return {
      min,
      max,
      lo: Math.min(min, max),
      hi: Math.max(min, max),
      step: finiteRange(this.temperatureStep, 0, 0),
    };
  }

  /** Clamps `raw` into `[temperatureMin, temperatureMax]`, snapped to
   *  `temperatureStep`'s grid anchored at the low end -- exactly mirroring
   *  `lr-slider`'s own private `clampValue`/`domain` math -- so the
   *  mirrored `temperature` readout can never disagree with what the nested
   *  slider itself would clamp the same raw number to. */
  private clampTemperature(raw: number): number {
    const { lo, hi, step } = this.temperatureDomain;
    const hasStep = step > 0;
    let stepped = Math.min(hi, Math.max(lo, finiteNumber(raw, lo)));
    if (hasStep) {
      const ratio = (stepped - lo) / step;
      if (Number.isFinite(ratio)) {
        const candidate = lo + Math.round(ratio) * step;
        if (Number.isFinite(candidate)) {
          const factor = 10 ** Math.min(decimalPlaces(step), 15);
          stepped = Math.round(candidate * factor) / factor;
        }
      }
    }
    return Math.min(hi, Math.max(lo, stepped));
  }

  private formatTemperature(value: number): string {
    const expanded = getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 20 }).format(value);
    if (expanded.length <= 24) return expanded;
    return getNumberFormat(this.effectiveLocale, {
      notation: 'scientific',
      maximumSignificantDigits: 6,
    }).format(value);
  }

  private emitChange(): void {
    this.emit('lr-change', {
      model: this.model,
      inCatalog: this.inCatalog,
      temperature: this.temperature,
    });
  }

  private onModelChange = (e: CustomEvent<{ value: string; inCatalog: boolean }>): void => {
    e.stopPropagation();
    if (this.disabled) return;
    this.model = e.detail.value;
    this.emitChange();
  };

  private onTemperatureChange = (e: CustomEvent<{ value: number }>): void => {
    e.stopPropagation();
    if (this.disabled) return;
    this.temperature = this.clampTemperature(e.detail.value);
    this.emitChange();
  };

  /** Mirrors the slider's *live* (uncommitted) value into the panel's own
   *  `temperature` readout -- display only, no `emitChange()` -- mirroring
   *  native `input` (continuous) vs. `change` (committed) semantics so the
   *  readout tracks an in-progress drag/key-repeat instead of only updating
   *  once the interaction commits. */
  private onTemperatureInput = (e: CustomEvent<{ value: number }>): void => {
    e.stopPropagation();
    if (this.disabled) return;
    this.temperature = this.clampTemperature(e.detail.value);
  };

  private containNativeEvent = (event: Event): void => {
    event.stopPropagation();
  };

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has('temperature') ||
      changed.has('temperatureMin') ||
      changed.has('temperatureMax') ||
      changed.has('temperatureStep')
    ) {
      const clamped = this.clampTemperature(this.temperature);
      if (clamped !== this.temperature) this.temperature = clamped;
    }
  }

  override render(): TemplateResult {
    const domain = this.temperatureDomain;
    const modelLabel = this.localize('model');
    const temperatureLabel = this.localize('temperature');
    return html`
      <div part="base" @input=${this.containNativeEvent} @change=${this.containNativeEvent}>
        <div part="model-row">
          <lr-model-select
            part="model-select"
            exportparts="form-control-label:model-label"
            .provider=${this.provider}
            .catalog=${this.catalog}
            .value=${this.model}
            .label=${modelLabel}
            .allowCustom=${this.allowCustom}
            .disabled=${this.disabled}
            placeholder=${this.localize('selectModel')}
            @lr-change=${this.onModelChange}
          ></lr-model-select>
        </div>
        <div part="temperature-row">
          <span part="temperature-label">${temperatureLabel}</span>
          <lr-slider
            aria-label=${temperatureLabel}
            .min=${domain.min}
            .max=${domain.max}
            .step=${domain.step}
            .valueAsNumber=${this.temperature}
            .showValue=${false}
            .disabled=${this.disabled}
            @lr-input=${this.onTemperatureInput}
            @lr-change=${this.onTemperatureChange}
          ></lr-slider>
          <span part="temperature-value" aria-hidden="true">${this.formatTemperature(this.temperature)}</span>
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
