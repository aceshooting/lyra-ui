import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { BUILDER_CHILD_EVENTS, containShadowChildEvents } from '../../../internal/child-event-containment.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { monitorIcon, moonIcon, sunIcon } from '../../../internal/icons.js';
import type { LyraMessageKey } from '../../../internal/localization-types.js';
import {
  LYRA_LOOKS,
  getLyraStyle,
  resetLyraStyle,
  setLyraStyle,
  type LyraLookEntry,
  type LyraStyle,
  type LyraStyleChangeDetail,
  type LyraStyleChoices,
  type LyraStyleField,
} from '../../../theme/theme.js';
import { GEMSTONE_KEYS, GEMSTONES, type GemstoneKey } from '../../../theme/gemstones-data.js';
import type { LyraSegmentedItem } from '../../layout/segmented/segmented.class.js';
import type { SwatchPickerItem } from '../../forms/swatch-picker/swatch-picker.class.js';
import { styles } from './style-panel.styles.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_copy, LYRA_DEFAULT_date, LYRA_DEFAULT_map } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_styleAccentAmethyst, LYRA_DEFAULT_styleAccentAquamarine, LYRA_DEFAULT_styleAccentEmerald, LYRA_DEFAULT_styleAccentHematite, LYRA_DEFAULT_styleAccentPeridot, LYRA_DEFAULT_styleAccentRuby, LYRA_DEFAULT_styleAccentSapphire, LYRA_DEFAULT_styleAccentTopaz, LYRA_DEFAULT_styleAccentTourmaline, LYRA_DEFAULT_styleLookData, LYRA_DEFAULT_styleLookHighContrast, LYRA_DEFAULT_styleLookLyra, LYRA_DEFAULT_styleLookMaterial, LYRA_DEFAULT_styleLookShadcn, LYRA_DEFAULT_styleLookTerminal, LYRA_DEFAULT_stylePanelAccent, LYRA_DEFAULT_stylePanelDensity, LYRA_DEFAULT_stylePanelDensityComfortable, LYRA_DEFAULT_stylePanelDensityCompact, LYRA_DEFAULT_stylePanelDensityTouch, LYRA_DEFAULT_stylePanelLabel, LYRA_DEFAULT_stylePanelLook, LYRA_DEFAULT_stylePanelMode, LYRA_DEFAULT_stylePanelModeDark, LYRA_DEFAULT_stylePanelModeLight, LYRA_DEFAULT_stylePanelModeSystem, LYRA_DEFAULT_stylePanelReset, LYRA_DEFAULT_stylePanelSurface, LYRA_DEFAULT_stylePanelSurfaceGlass, LYRA_DEFAULT_stylePanelSurfaceOpacity, LYRA_DEFAULT_stylePanelSurfaceSolid } from '../../../internal/default-strings/utility.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** One control the panel can render; `surface-opacity` is the glass opacity slider. */
export type LyraStylePanelAxis = 'mode' | 'look' | 'surface' | 'surface-opacity' | 'density' | 'accent';

/** Every axis, in render order. */
const STYLE_PANEL_AXES: readonly LyraStylePanelAxis[] = ['mode', 'look', 'surface', 'surface-opacity', 'density', 'accent'];

/** The style fields each axis owns, which is what its reset restores. */
const AXIS_FIELDS: Readonly<Record<LyraStylePanelAxis, readonly LyraStyleField[]>> = {
  mode: ['mode'],
  look: ['look'],
  surface: ['surface'],
  'surface-opacity': ['surfaceOpacity'],
  density: ['density'],
  accent: ['accent', 'accentBackground'],
};

/** Canonicalizes an `axes` list: known tokens in author order, duplicates dropped; none means all. */
function parseAxes(value: string): readonly LyraStylePanelAxis[] {
  const axes: LyraStylePanelAxis[] = [];
  for (const token of String(value ?? '').toLowerCase().split(/\s+/)) {
    const axis = token as LyraStylePanelAxis;
    if (STYLE_PANEL_AXES.includes(axis) && !axes.includes(axis)) axes.push(axis);
  }
  return axes.length > 0 ? axes : STYLE_PANEL_AXES;
}

const ACCENT_LABELS: Readonly<Record<GemstoneKey, LyraMessageKey>> = {
  emerald: 'styleAccentEmerald',
  peridot: 'styleAccentPeridot',
  topaz: 'styleAccentTopaz',
  ruby: 'styleAccentRuby',
  tourmaline: 'styleAccentTourmaline',
  amethyst: 'styleAccentAmethyst',
  aquamarine: 'styleAccentAquamarine',
  sapphire: 'styleAccentSapphire',
  hematite: 'styleAccentHematite',
};

export interface LyraStylePanelEventMap {
  'lr-change': CustomEvent<LyraStyleChangeDetail>;
}

/**
 * `<lr-style-panel>` — ready-made appearance controls bound to the document style runtime
 * (`setLyraStyle()`/`getLyraStyle()` from `theme.js`): colour mode, look, surface, glass
 * opacity, density, accent and a reset button, composed from `lr-segmented`, `lr-select`,
 * `lr-slider`, `lr-swatch-picker` and `lr-button`.
 *
 * Each control writes its own axis through `setLyraStyle()` (persisted like every other caller)
 * and the panel re-reads the style on every window `lr-style-change`, so it stays in step with
 * changes made elsewhere, including another panel or an operating-system mode flip. `axes`
 * chooses which controls render and in what order. `looks` lists the looks offered, defaulting
 * to the built-in `LYRA_LOOKS` with localized names; append an application's own entries to
 * offer them too. The reset button restores only the axes the panel shows. The glass opacity
 * slider is disabled while the surface is solid.
 *
 * Every label goes through the localization catalog. The child controls' own events stay inside
 * the panel; it reports user changes through one `lr-change`.
 *
 * @customElement lr-style-panel
 * @event lr-change - The user changed the style through this panel. `detail: LyraStyleChangeDetail`
 *   (`{ style, changed }`), the same detail as the window `lr-style-change` that change caused.
 * @csspart base - The `role="group"` container holding every control.
 * @csspart mode - The colour mode `lr-segmented`.
 * @csspart look - The look `lr-select`.
 * @csspart surface - The surface `lr-segmented`.
 * @csspart surface-opacity - The glass opacity `lr-slider`, valued 0 to 1 like `surfaceOpacity` and shown
 *   as a percentage.
 * @csspart density - The density `lr-segmented`.
 * @csspart accent - The accent row, holding its caption and swatches.
 * @csspart accent-label - The accent caption.
 * @csspart accent-picker - The accent `lr-swatch-picker`.
 * @csspart reset - The reset `lr-button`.
 * @cssprop [--lr-style-panel-gap=var(--lr-space-m)] - Space between the controls.
 * @status experimental
 * @since unreleased
 */
export class LyraStylePanel extends LyraElement<LyraStylePanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    copy: LYRA_DEFAULT_copy,
    date: LYRA_DEFAULT_date,
    map: LYRA_DEFAULT_map,
    styleAccentAmethyst: LYRA_DEFAULT_styleAccentAmethyst,
    styleAccentAquamarine: LYRA_DEFAULT_styleAccentAquamarine,
    styleAccentEmerald: LYRA_DEFAULT_styleAccentEmerald,
    styleAccentHematite: LYRA_DEFAULT_styleAccentHematite,
    styleAccentPeridot: LYRA_DEFAULT_styleAccentPeridot,
    styleAccentRuby: LYRA_DEFAULT_styleAccentRuby,
    styleAccentSapphire: LYRA_DEFAULT_styleAccentSapphire,
    styleAccentTopaz: LYRA_DEFAULT_styleAccentTopaz,
    styleAccentTourmaline: LYRA_DEFAULT_styleAccentTourmaline,
    styleLookData: LYRA_DEFAULT_styleLookData,
    styleLookHighContrast: LYRA_DEFAULT_styleLookHighContrast,
    styleLookLyra: LYRA_DEFAULT_styleLookLyra,
    styleLookMaterial: LYRA_DEFAULT_styleLookMaterial,
    styleLookShadcn: LYRA_DEFAULT_styleLookShadcn,
    styleLookTerminal: LYRA_DEFAULT_styleLookTerminal,
    stylePanelAccent: LYRA_DEFAULT_stylePanelAccent,
    stylePanelDensity: LYRA_DEFAULT_stylePanelDensity,
    stylePanelDensityComfortable: LYRA_DEFAULT_stylePanelDensityComfortable,
    stylePanelDensityCompact: LYRA_DEFAULT_stylePanelDensityCompact,
    stylePanelDensityTouch: LYRA_DEFAULT_stylePanelDensityTouch,
    stylePanelLabel: LYRA_DEFAULT_stylePanelLabel,
    stylePanelLook: LYRA_DEFAULT_stylePanelLook,
    stylePanelMode: LYRA_DEFAULT_stylePanelMode,
    stylePanelModeDark: LYRA_DEFAULT_stylePanelModeDark,
    stylePanelModeLight: LYRA_DEFAULT_stylePanelModeLight,
    stylePanelModeSystem: LYRA_DEFAULT_stylePanelModeSystem,
    stylePanelReset: LYRA_DEFAULT_stylePanelReset,
    stylePanelSurface: LYRA_DEFAULT_stylePanelSurface,
    stylePanelSurfaceGlass: LYRA_DEFAULT_stylePanelSurfaceGlass,
    stylePanelSurfaceOpacity: LYRA_DEFAULT_stylePanelSurfaceOpacity,
    stylePanelSurfaceSolid: LYRA_DEFAULT_stylePanelSurfaceSolid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = eventCollectionSupport;

  /** `lr-change` detail (including its `changed` list) is detached and frozen before dispatch. */
  protected static override readonly immutableEventDetails = Object.freeze(['lr-change']);

  static override styles = [LyraElement.styles, styles];

  /** Child value requests and change events stay inside the panel, which reports its own. */
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    const root = super.createRenderRoot();
    containShadowChildEvents(root, [
      ...BUILDER_CHILD_EVENTS, 'lr-change-request',
    ]);
    return root;
  }

  /**
   * Space-separated controls to render, in order: `mode`, `look`, `surface`, `surface-opacity`,
   * `density` and `accent`. Unknown tokens are dropped; a list with none renders every control.
   * @default 'mode look surface surface-opacity density accent'
   */
  @property() axes = STYLE_PANEL_AXES.join(' ');

  /** The looks the look control offers, in order. Built-in entries show their localized name and
   *  application entries without a `labelKey` show `name`. */
  @property({ attribute: false }) looks: readonly LyraLookEntry[] = LYRA_LOOKS;

  /** Accessible name of the group. Omitted, it is the localized "Appearance". */
  @property() label?: string;

  /** Hides the reset button. */
  @property({ type: Boolean, attribute: 'without-reset', reflect: true }) withoutReset = false;

  /** Disables every control. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @state() private current: Readonly<LyraStyle> = getLyraStyle();

  private readonly onStyleChange = (event: CustomEvent<LyraStyleChangeDetail>): void => {
    this.current = event.detail.style;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('lr-style-change', this.onStyleChange);
    this.current = getLyraStyle();
  }

  override disconnectedCallback(): void {
    window.removeEventListener('lr-style-change', this.onStyleChange);
    super.disconnectedCallback();
  }

  /** Runs one style write and re-emits the window change it caused as this panel's `lr-change`. */
  private commit(write: () => void): void {
    let detail: LyraStyleChangeDetail | undefined;
    const capture = (event: CustomEvent<LyraStyleChangeDetail>): void => {
      detail = event.detail;
    };
    window.addEventListener('lr-style-change', capture);
    try {
      write();
    } finally {
      window.removeEventListener('lr-style-change', capture);
    }
    if (detail && detail.changed.length > 0) this.emit('lr-change', detail);
  }

  private set(choices: LyraStyleChoices): void {
    this.commit(() => setLyraStyle(choices));
  }

  private readonly onModeChange = (event: CustomEvent<{ value: string }>): void => {
    this.set({ mode: event.detail.value as LyraStyle['mode'] });
  };

  private readonly onLookChange = (event: Event): void => {
    const value = (event.target as HTMLElement & { value: string }).value;
    if (value) this.set({ look: value });
  };

  private readonly onSurfaceChange = (event: CustomEvent<{ value: string }>): void => {
    this.set({ surface: event.detail.value as LyraStyle['surface'] });
  };

  private readonly onOpacityChange = (event: Event): void => {
    this.set({ surfaceOpacity: (event.target as HTMLElement & { valueAsNumber: number }).valueAsNumber });
  };

  private readonly onDensityChange = (event: CustomEvent<{ value: string }>): void => {
    this.set({ density: event.detail.value as LyraStyle['density'] });
  };

  private readonly onAccentChange = (event: CustomEvent<{ value: string }>): void => {
    this.set({ accent: event.detail.value as GemstoneKey });
  };

  private readonly onReset = (): void => {
    const fields = parseAxes(this.axes).flatMap((axis) => AXIS_FIELDS[axis]);
    this.commit(() => resetLyraStyle(fields));
  };

  private readonly formatOpacity = (value: number): string =>
    getNumberFormat(this.effectiveLocale, { style: 'percent', maximumFractionDigits: 0 }).format(value);

  private lookLabel(entry: LyraLookEntry): string {
    return entry.labelKey ? this.localize(entry.labelKey) : entry.name;
  }

  private renderAxis(axis: LyraStylePanelAxis): TemplateResult {
    const style = this.current;
    switch (axis) {
      case 'mode': {
        const items: LyraSegmentedItem[] = [
          { value: 'light', label: this.localize('stylePanelModeLight'), icon: sunIcon() },
          { value: 'dark', label: this.localize('stylePanelModeDark'), icon: moonIcon() },
          { value: 'system', label: this.localize('stylePanelModeSystem'), icon: monitorIcon() },
        ];
        return html`<lr-segmented part="mode" label-display="visible" .label=${this.localize('stylePanelMode')}
          .items=${items} .value=${live(style.mode === 'unset' ? '' : style.mode)} .disabled=${this.disabled}
          @lr-change=${this.onModeChange}></lr-segmented>`;
      }
      case 'look':
        return html`<lr-select part="look" .label=${this.localize('stylePanelLook')} .value=${live(style.look)}
          .disabled=${this.disabled} @lr-change=${this.onLookChange}>
          ${(Array.isArray(this.looks) ? this.looks : LYRA_LOOKS).map((entry) => html`<lr-option value=${entry.id}>${this.lookLabel(entry)}</lr-option>`)}
        </lr-select>`;
      case 'surface': {
        const items: LyraSegmentedItem[] = [
          { value: 'solid', label: this.localize('stylePanelSurfaceSolid') },
          { value: 'glass', label: this.localize('stylePanelSurfaceGlass') },
        ];
        return html`<lr-segmented part="surface" label-display="visible" .label=${this.localize('stylePanelSurface')}
          .items=${items} .value=${live(style.surface)} .disabled=${this.disabled}
          @lr-change=${this.onSurfaceChange}></lr-segmented>`;
      }
      case 'surface-opacity':
        return html`<lr-slider part="surface-opacity" .label=${this.localize('stylePanelSurfaceOpacity')}
          .min=${0} .max=${1} .step=${0.01} .valueAsNumber=${live(style.surfaceOpacity)}
          .valueFormatter=${this.formatOpacity} .withValue=${true} value-display="formatted" value-placement="label"
          .disabled=${this.disabled || style.surface !== 'glass'}
          @lr-change=${this.onOpacityChange}></lr-slider>`;
      case 'density': {
        const items: LyraSegmentedItem[] = [
          { value: 'compact', label: this.localize('stylePanelDensityCompact') },
          { value: 'comfortable', label: this.localize('stylePanelDensityComfortable') },
          { value: 'touch', label: this.localize('stylePanelDensityTouch') },
        ];
        return html`<lr-segmented part="density" label-display="visible" .label=${this.localize('stylePanelDensity')}
          .items=${items} .value=${live(style.density)} .disabled=${this.disabled}
          @lr-change=${this.onDensityChange}></lr-segmented>`;
      }
      case 'accent': {
        const label = this.localize('stylePanelAccent');
        const items: SwatchPickerItem[] = GEMSTONE_KEYS.map((key) => ({
          value: key, color: GEMSTONES[key].fill, label: this.localize(ACCENT_LABELS[key]), gemstone: key,
        }));
        return html`<div part="accent">
          <span part="accent-label" aria-hidden="true">${label}</span>
          <lr-swatch-picker part="accent-picker" mode="gemstone" aria-label=${label} .items=${items}
            .value=${style.accentName} .disabled=${this.disabled}
            @lr-change=${this.onAccentChange}></lr-swatch-picker>
        </div>`;
      }
    }
  }

  override render(): TemplateResult {
    const name = this.label == null ? this.localize('stylePanelLabel') : this.label;
    return html`<div part="base" role="group" aria-label=${name}>
      ${parseAxes(this.axes).map((axis) => this.renderAxis(axis))}
      ${this.withoutReset
        ? nothing
        : html`<lr-button part="reset" .disabled=${this.disabled} @click=${this.onReset}>${this.localize('stylePanelReset')}</lr-button>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-style-panel': LyraStylePanel;
  }
}
