import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { LitElement, css, html, type TemplateResult } from 'lit';
import {
  GEMSTONE_KEYS,
  GEMSTONES,
  type GemstoneKey,
} from '../../../theme/gemstones-data.js';
import {
  gemstoneGlyph,
  gemstoneSelectedGlyphStyles,
} from '../../../theme/gemstones.js';
import type { LyraSwatchPicker } from './swatch-picker.js';
import type { LyraSizeStep } from '../../../internal/variants.js';
import './swatch-picker.js';
import '../icon-button/icon-button.js';
import '../../overlays/overlay/popover.js';

const accents = () => [
  { value: 'blue', color: 'var(--lr-color-brand)', label: 'Blue' },
  { value: 'green', color: 'var(--lr-color-success)', label: 'Green' },
  { value: 'purple', color: 'var(--lr-color-chart-1)', label: 'Purple' },
  { value: 'orange', color: 'var(--lr-color-warning)', label: 'Orange' },
  { value: 'red', color: 'var(--lr-color-danger)', label: 'Red' },
];

const gemstoneAccents = (order = GEMSTONE_KEYS) =>
  order.map((key) => ({
    value: key,
    color: GEMSTONES[key].fill,
    label: key[0]!.toUpperCase() + key.slice(1),
    gemstone: key,
  }));

/** A `stroke="currentColor"` gem glyph (brilliant-cut) -- picks up each option's color through the
 *  swatch's `color` custom property with no extra wiring. */
const gemIconBrilliant = () => html`
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M10.5 3 8 9l4 13 4-13-2.5-6" />
    <path
      d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"
    />
    <path d="M2 9h20" />
  </svg>
`;

/** A second, distinct gem glyph (round, faceted) -- demonstrates that each option can carry its
 *  own shape, not just its own color, for a "several distinct gemstones" picker. */
const gemIconRound = () => html`
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2 20 8 17 21 7 21 4 8Z" />
    <path d="M4 8h16M12 2v6M7 21 12 8l5 13" />
  </svg>
`;

/** A third, distinct gem glyph (emerald-cut). */
const gemIconEmerald = () => html`
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M7 4h10l3 3v10l-3 3H7l-3-3V7Z" />
    <path d="M4 7h16M4 17h16" />
  </svg>
`;

/** Cycles through the three distinct gem glyphs above by index, so a multi-swatch accent picker
 *  shows a genuinely varied set of gemstones rather than the same shape repeated in every color. */
const gemIcons = [gemIconBrilliant, gemIconRound, gemIconEmerald];

const meta: Meta = {
  title: 'Swatch Picker',
  component: 'lr-swatch-picker',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single-select picker over a small, fixed set of color swatches with the WAI-ARIA APG `radiogroup` contract built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or arrow-key move both select immediately), cyclic Arrow/Home/End navigation. Distinct from `<lr-color-picker>`\'s freeform native input -- it picks exactly one of N designer-chosen named colors.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-swatch-picker aria-label="Accent color" .items=${accents()} value="purple"></lr-swatch-picker>
  `,
};

/** Forced-colors evidence uses shipped palette data rather than palette tokens, whose deliberate
 *  system-color remapping is ordinary chrome behavior. The visual harness verifies that all five
 *  intrinsic swatch fills remain chromatic and pairwise distinct under real browser emulation. */
export const ForcedColorsIntrinsic: Story = {
  name: 'Forced colors intrinsic data',
  render: () => html`
    <lr-swatch-picker
      aria-label="Intrinsic data colors"
      .items=${[
        { value: 'blue', color: GEMSTONES.sapphire.fill, label: 'Blue' },
        { value: 'green', color: GEMSTONES.emerald.fill, label: 'Green' },
        { value: 'purple', color: GEMSTONES.amethyst.fill, label: 'Purple' },
        { value: 'orange', color: GEMSTONES.topaz.fill, label: 'Orange' },
        { value: 'red', color: GEMSTONES.ruby.fill, label: 'Red' },
      ]}
    ></lr-swatch-picker>
  `,
};

/** `size` spans the same `2xs`–`xl` scale as `lr-input`, default `m`. */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraSizeStep[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem">
        ${sizes.map((size) => html`<lr-swatch-picker size=${size} aria-label=${`Size "${size}"`} .items=${accents()} value="purple"></lr-swatch-picker>`)}
      </div>
    `;
  },
};

export const CustomIcon: Story = {
  name: 'Custom icon shape',
  parameters: {
    docs: {
      description: {
        story:
          "Per-option `icon` replaces the plain filled circle with a consumer-supplied shape -- here, several distinct gemstone glyphs (brilliant, round, emerald-cut), one per swatch. The shape's subtree remains visible but inert and aria-hidden so the swatch button stays the sole action. A `stroke=\"currentColor\"`/`fill=\"currentColor\"` SVG is tinted automatically through the swatch's `color` custom property, so each option's `color` still drives both the value and its own glyph's tint.",
      },
    },
  },
  render: () => html`
    <lr-swatch-picker
      aria-label="Accent color"
      .items=${accents().map((option, i) => ({ ...option, icon: gemIcons[i % gemIcons.length]!() }))}
      value="purple"
    ></lr-swatch-picker>
  `,
};

export const ShiningSelection: Story = {
  name: 'Shining selection (gemstone accent picker)',
  parameters: {
    docs: {
      description: {
        story:
          'Combines `--lr-swatch-picker-selected-blur` (a soft glow around the selected gem, tinted by its own color) with `--lr-swatch-picker-shine-duration` (a rhythmic brighten-and-settle pulse) for a genuinely "shining" selected state -- both default to off/static for every other consumer; a gemstone-flavored accent-theme picker like this one opts into both explicitly.',
      },
    },
  },
  render: () => html`
    <lr-swatch-picker
      aria-label="Accent color"
      style="--lr-swatch-picker-selected-blur: 0.35rem; --lr-swatch-picker-shine-duration: 1.6s;"
      .items=${accents().map((option, i) => ({ ...option, icon: gemIcons[i % gemIcons.length]!() }))}
      value="purple"
    ></lr-swatch-picker>
  `,
};

export const GemstoneMode: Story = {
  name: 'Gemstone mode',
  parameters: {
    docs: {
      description: {
        story:
          'Gemstone mode supplies the canonical faceted glyph and selected glow/shine recipe. The options array still controls order and value still controls the initial selection, so each consumer can keep its own defaults and palette order.',
      },
    },
  },
  render: () => html`
    <lr-swatch-picker
      mode="gemstone"
      aria-label="Gemstone accent"
      .items=${gemstoneAccents(['emerald', 'ruby', 'amethyst', 'sapphire', 'hematite'])}
      value="amethyst"
    ></lr-swatch-picker>
  `,
};

export const GemstoneGlyphOutsidePicker: Story = {
  name: 'Gemstone glyph outside the picker (header trigger)',
  parameters: {
    docs: {
      description: {
        story:
          'A trigger button rendering `gemstoneGlyph()` for the currently selected accent -- styled with `gemstoneSelectedGlyphStyles`, the exact same `theme/gemstones.js` export `lr-swatch-picker` itself consumes for its own checked gemstone swatch below -- so the trigger and the picker it opens paint an identical halo/shine and can never drift apart. Both are importable independently of this picker for any component that needs to show the current gemstone selection outside it.',
      },
    },
  },
  render: () => html`
    <style>
      ${gemstoneSelectedGlyphStyles.cssText}
      .gemstone-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 2.5rem;
        block-size: 2.5rem;
        border-radius: 50%;
        border: none;
        background: none;
        color: ${GEMSTONES.amethyst.fill};
        cursor: pointer;
        font-size: 1.5rem;
      }
    </style>
    <button
      class="gemstone-trigger"
      type="button"
      aria-label="Change accent color (currently Amethyst)"
      data-lr-gemstone-selected
    >
      ${gemstoneGlyph()}
    </button>
    <lr-swatch-picker
      mode="gemstone"
      aria-label="Gemstone accent"
      .items=${gemstoneAccents(['emerald', 'ruby', 'amethyst', 'sapphire', 'hematite'])}
      value="amethyst"
    ></lr-swatch-picker>
  `,
};

/** A stand-in for an application's own header component composing the documented
 *  `gemstoneAccentPicker` pattern (`llms/forms.md`). The application owns the selected key, the
 *  localized strings and the accent it applies (`--accent-color` here); the library parts stay
 *  controlled. */
const gemstoneAccentPickerTag = 'app-gemstone-accent-picker';
const gemstoneName = (key: GemstoneKey): string =>
  key[0]!.toUpperCase() + key.slice(1);

class AppGemstoneAccentPicker extends LitElement {
  static override styles = [
    gemstoneSelectedGlyphStyles,
    css`
      :host {
        display: inline-block;
        --caption-color: var(--lr-color-text-quiet);
        --text-color: var(--lr-color-text);
      }
      .gemstone-accent-picker {
        --lr-overlay-max-inline-size: 22rem;
        --lr-gemstone-selected-color: color-mix(
          in srgb,
          var(--accent-color) 92%,
          transparent
        );
        --lr-gemstone-selected-blur: 0.42rem;
      }
      .gemstone-accent-picker lr-icon-button {
        --lr-icon-button-background: transparent;
        --lr-icon-button-background-hover: transparent;
        --lr-icon-button-background-active: transparent;
        --lr-icon-button-border: none;
      }
      .gem {
        display: inline-flex;
        inline-size: 1.15rem;
        block-size: 1.15rem;
      }
      .gem svg {
        inline-size: 100%;
        block-size: 100%;
      }
      .palette {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        inline-size: 20rem;
        padding: 0.3rem;
      }
      .heading {
        margin: 0.2rem 0.3rem 0.5rem;
        color: var(--caption-color);
        font-size: 0.75rem;
        font-weight: 600;
      }
      .name {
        color: var(--text-color);
      }
      .palette lr-swatch-picker {
        padding: 0 0.3rem 0.3rem;
        --lr-swatch-picker-hit-size: 1.75rem;
        --lr-swatch-picker-wrap: nowrap;
        --lr-swatch-picker-gap: 0.25rem;
      }
      @media (max-width: 30rem) {
        .palette {
          inline-size: auto;
        }
        .palette lr-swatch-picker {
          --lr-swatch-picker-hit-size: 1.5rem;
          --lr-swatch-picker-gap: 0.125rem;
        }
      }
    `,
  ];

  // Built once: a fresh array on every render would re-create every swatch and drop focus.
  private readonly items = gemstoneAccents();
  private selected: GemstoneKey = 'amethyst';

  private readonly onAccentChange = (
    event: CustomEvent<{ value: string }>
  ): void => {
    const next = GEMSTONE_KEYS.find((key) => key === event.detail.value);
    if (next === undefined) return;
    this.selected = next;
    this.requestUpdate();
  };

  override render(): TemplateResult {
    const name = gemstoneName(this.selected);
    return html`
      <lr-popover
        class="gemstone-accent-picker"
        placement="bottom-end"
        popup-role="dialog"
        aria-label="Accent color"
        style="--accent-color: ${GEMSTONES[this.selected].fill}"
      >
        <lr-icon-button slot="trigger" label=${`Accent color: ${name}`}>
          <span class="gem" data-lr-gemstone-selected aria-hidden="true"
            >${gemstoneGlyph(GEMSTONES[this.selected].fill)}</span
          >
        </lr-icon-button>
        <div class="palette">
          <p class="heading">Gemstone: <span class="name">${name}</span></p>
          <lr-swatch-picker
            mode="gemstone"
            aria-label="Accent color"
            .items=${this.items}
            .value=${this.selected}
            @lr-change=${this.onAccentChange}
          ></lr-swatch-picker>
        </div>
      </lr-popover>
    `;
  }
}

if (
  typeof customElements !== 'undefined' &&
  !customElements.get(gemstoneAccentPickerTag)
) {
  customElements.define(gemstoneAccentPickerTag, AppGemstoneAccentPicker);
}

export const GemstoneAccentPicker: Story = {
  name: 'gemstoneAccentPicker composition (header trigger + popover)',
  parameters: {
    docs: {
      description: {
        story:
          'The documented `gemstoneAccentPicker` pattern, composed by an application element rather than shipped as a tag: an `lr-icon-button` trigger showing the current gem with `gemstoneSelectedGlyphStyles` (0.42rem halo at 92% of the accent), an `lr-popover` dialog with one "Gemstone: name" caption, and all nine canonical gems in one `lr-swatch-picker mode="gemstone"` row -- 28px targets with 4px gaps, 24px with 2px gaps below 30rem. The picker stays controlled through `value` and `lr-change`; applying and persisting the accent stays with the application.',
      },
    },
  },
  render: () => html`<app-gemstone-accent-picker></app-gemstone-accent-picker>`,
};

export const NoSelection: Story = {
  name: 'No selection',
  parameters: {
    docs: {
      description: {
        story:
          'With `value` left `null`, no swatch is checked, but the first swatch stays tabbable so the radiogroup is keyboard-reachable.',
      },
    },
  },
  render: () => html`
    <lr-swatch-picker aria-label="Accent color" .items=${accents()}></lr-swatch-picker>
  `,
};

export const LivePaletteChanges: Story = {
  name: 'Live palette changes preserve focus',
  parameters: {
    docs: {
      description: {
        story:
          'Focus a swatch, then activate “Remove focused swatch” with a pointer. The control keeps focus inside the radiogroup on the nearest surviving option without changing the controlled value or firing `lr-change`. Reordering preserves the focused option by object identity.',
      },
    },
  },
  render: () => {
    const palette = accents();
    const pickerFor = (event: Event) =>
      (event.currentTarget as HTMLElement)
        .closest<HTMLElement>('[data-live-palette]')!
        .querySelector<LyraSwatchPicker>('lr-swatch-picker')!;
    const keepSwatchFocused = (event: PointerEvent) => event.preventDefault();
    return html`
      <div data-live-palette style="display: grid; gap: var(--lr-space-s); justify-items: start;">
        <lr-swatch-picker
          aria-label="Dynamic accent color"
          .items=${palette}
          value="purple"
        ></lr-swatch-picker>
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-xs);">
          <button
            @pointerdown=${keepSwatchFocused}
            @click=${(event: Event) => {
              const picker = pickerFor(event);
              const focusedValue = picker.shadowRoot?.activeElement?.getAttribute('data-value');
              picker.items = picker.items.filter((option) => option.value !== focusedValue);
            }}
          >Remove focused swatch</button>
          <button
            @pointerdown=${keepSwatchFocused}
            @click=${(event: Event) => {
              const picker = pickerFor(event);
              picker.items = [...picker.items].reverse();
            }}
          >Reverse palette</button>
          <button
            @pointerdown=${keepSwatchFocused}
            @click=${(event: Event) => {
              pickerFor(event).items = palette;
            }}
          >Restore palette</button>
        </div>
      </div>
    `;
  },
};

export const Rethemed: Story = {
  name: 'Rethemed selection ring',
  parameters: {
    docs: {
      description: {
        story:
          'The `--lr-swatch-picker-selected-color` custom property retints the ring drawn around the selected swatch, independently of the focus outline.',
      },
    },
  },
  render: () => html`
    <lr-swatch-picker
      aria-label="Accent color"
      style="--lr-swatch-picker-selected-color: var(--lr-color-success);"
      .items=${accents()}
      value="red"
    ></lr-swatch-picker>
  `,
};

/** Narrow-allocation evidence: a many-swatch row reflowing inside a 320px panel/dialog/split-pane
 *  rather than overflowing it. */
export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-swatch-picker
        aria-label="Accent color"
        .items=${[
          ...accents(),
          { value: 'teal', color: 'var(--lr-color-chart-3)', label: 'Teal' },
          { value: 'pink', color: 'var(--lr-color-chart-6)', label: 'Pink' },
          { value: 'slate', color: 'var(--lr-color-chart-4)', label: 'Slate' },
        ]}
        value="teal"
      ></lr-swatch-picker>
    </div>
  `,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  render: () => html`
    <lr-swatch-picker
      dir="rtl"
      aria-label="لون التمييز"
      .items=${[
        { value: 'blue', color: 'var(--lr-color-brand)', label: 'أزرق' },
        { value: 'green', color: 'var(--lr-color-success)', label: 'أخضر' },
        { value: 'red', color: 'var(--lr-color-danger)', label: 'أحمر' },
      ]}
      value="green"
    ></lr-swatch-picker>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lr-swatch-picker
        aria-label="Accent color"
        .items=${accents()}
        value="blue"
        @lr-change=${(e: CustomEvent<{ value: string }>) => {
          const out = document.getElementById('swatch-picker-log');
          if (out) out.textContent = `lr-change: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-swatch-picker>
      <p id="swatch-picker-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display: grid; gap: 1rem;">
      <lr-swatch-picker aria-label="Accent color" .items=${accents()} value="blue"></lr-swatch-picker>
      <lr-swatch-picker
        disabled
        aria-label="Accent color (locked while saving)"
        .items=${accents()}
        value="blue"
      ></lr-swatch-picker>
    </div>
  `,
};

export const ImmediateDisable: StoryObj = {
  render: () => html`
    <div>
      <lr-swatch-picker aria-label="Accent" .items=${accents()}></lr-swatch-picker>
      <button @click=${(event: Event) => {
        const button = event.currentTarget as HTMLElement;
        button.focus();
        const picker = button.parentElement!.querySelector('lr-swatch-picker')!;
        picker.disabled = true;
        picker.click();
        picker.focus();
      }}>Disable and keep focus here</button>
      <button @click=${(event: Event) => {
        (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-swatch-picker')!.disabled = false;
      }}>Enable picker</button>
    </div>
  `,
};
