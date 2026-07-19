import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './swatch-picker.js';

const accents = () => [
  { value: 'blue', color: 'var(--lr-color-brand)', label: 'Blue' },
  { value: 'green', color: 'var(--lr-color-success)', label: 'Green' },
  { value: 'purple', color: 'var(--lr-color-chart-1)', label: 'Purple' },
  { value: 'orange', color: 'var(--lr-color-warning)', label: 'Orange' },
  { value: 'red', color: 'var(--lr-color-danger)', label: 'Red' },
];

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
    <lr-swatch-picker label="Accent color" .options=${accents()} value="purple"></lr-swatch-picker>
  `,
};

export const CustomIcon: Story = {
  name: 'Custom icon shape',
  parameters: {
    docs: {
      description: {
        story:
          "Per-option `icon` replaces the plain filled circle with a consumer-supplied shape -- here, several distinct gemstone glyphs (brilliant, round, emerald-cut), one per swatch. A `stroke=\"currentColor\"`/`fill=\"currentColor\"` SVG is tinted automatically through the swatch's `color` custom property, so each option's `color` still drives both the value and its own glyph's tint.",
      },
    },
  },
  render: () => html`
    <lr-swatch-picker
      label="Accent color"
      .options=${accents().map((option, i) => ({ ...option, icon: gemIcons[i % gemIcons.length]!() }))}
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
      label="Accent color"
      style="--lr-swatch-picker-selected-blur: 0.35rem; --lr-swatch-picker-shine-duration: 1.6s;"
      .options=${accents().map((option, i) => ({ ...option, icon: gemIcons[i % gemIcons.length]!() }))}
      value="purple"
    ></lr-swatch-picker>
  `,
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
    <lr-swatch-picker label="Accent color" .options=${accents()}></lr-swatch-picker>
  `,
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
      label="Accent color"
      style="--lr-swatch-picker-selected-color: var(--lr-color-success);"
      .options=${accents()}
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
        label="Accent color"
        .options=${[
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
      label="لون التمييز"
      .options=${[
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
        label="Accent color"
        .options=${accents()}
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
