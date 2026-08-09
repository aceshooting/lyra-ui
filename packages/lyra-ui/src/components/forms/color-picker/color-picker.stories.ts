import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { GEMSTONES } from '../../../theme/gemstones-data.js';
import type { LyraColorPickerSize, LyraColorPickerFormat } from './color-picker.js';
import './color-picker.js';

// A color picker's `value` is a color *literal* by definition -- `var(--lr-color-brand)` is not a
// parseable color and the control would reject it -- so these demos take their colors from the
// shipped gemstone accent palette rather than inventing hexes here, the same way
// swatch-picker.stories.ts does. Retheming that palette retheme these demos with it.
const ACCENT = GEMSTONES.sapphire.fill;
const DANGER = GEMSTONES.ruby.fill;
const SUCCESS = GEMSTONES.emerald.fill;
/** Alpha suffix on an `#rrggbb` value, i.e. 50% -- the `opacity` demo's whole point. */
const HALF_ALPHA = '80';

const meta: Meta = { title: 'Form/Color picker', component: 'lr-color-picker', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-color-picker label="Accent color"></lr-color-picker>` };

/** The panel carries the saturation/brightness grid, the hue slider, the value field, the format
 *  toggle, and — where the browser exposes the EyeDropper API — a screen picker. */
export const Open: StoryObj = {
  render: () => html`
    <div style="block-size: 20rem">
      <lr-color-picker label="Accent color" value=${ACCENT} open></lr-color-picker>
    </div>
  `,
};

/** Dragging a grid or slider is a live `input` preview. Releasing commits one `change`; an
 * interrupted gesture (pointer cancellation, lost capture, disablement, or reparenting) restores
 * the pre-drag visible and submitted value without emitting a commit. */
export const ReversiblePointerPreview: StoryObj = {
  name: 'Reversible pointer preview',
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-s); block-size:22rem; max-inline-size:24rem;">
      <lr-color-picker label="Drag a colour, then release or interrupt" value=${ACCENT} open></lr-color-picker>
      <p style="margin:0; color:var(--lr-color-text-quiet); font-size:var(--lr-font-size-sm);">
        Pointer release commits. A canceled or capture-lost drag returns to the colour present when
        the gesture began.
      </p>
    </div>
  `,
};

/** `inline` removes the popup trigger and keeps the complete picker panel in normal flow.
 * `no-format-toggle` is the Shoelace spelling of `without-format-toggle`; `default-value` supplies
 * the reset value. */
export const InlineCompatibility: StoryObj = {
  name: 'Inline and compatibility aliases',
  render: () => html`
    <lr-color-picker
      inline
      with-label
      with-hint
      no-format-toggle
      default-value=${ACCENT}
      swatches=${[ACCENT, SUCCESS, DANGER].join('; ')}
      style="--grid-width: 20rem; --slider-height: 0.875rem;"
    >
      <span slot="label">Inline accent colour</span>
      <span slot="hint">Uses the upstream geometry aliases and reset-default spelling.</span>
    </lr-color-picker>
  `,
};

/** `hoist` switches the popup to fixed positioning so it can escape a clipping ancestor. */
export const Hoisted: StoryObj = {
  render: () => html`
    <div style="overflow:auto; block-size:10rem; padding-block:4rem;">
      <lr-color-picker label="Hoisted colour" value=${ACCENT} hoist open></lr-color-picker>
    </div>
  `,
};

/** `format` decides how `value` is serialized; input is parsed permissively regardless. */
export const Formats: StoryObj = {
  render: () => {
    const formats: LyraColorPickerFormat[] = ['hex', 'rgb', 'hsl', 'hsv'];
    return html`
      <div style="display: flex; gap: 1rem">
        ${formats.map(
          (format) => html`<lr-color-picker
            label=${format.toUpperCase()}
            format=${format}
            value=${ACCENT}
          ></lr-color-picker>`,
        )}
      </div>
    `;
  },
};

/** `uppercase` serializes the same colour in upper case. */
export const Uppercase: StoryObj = {
  render: () => html`<lr-color-picker label="Accent color" value=${ACCENT} uppercase></lr-color-picker>`,
};

/** `opacity` adds the alpha slider and an alpha-carrying value (`#rrggbbaa`, functional `rgba`, ...). */
export const Opacity: StoryObj = {
  render: () => html`
    <div style="block-size: 20rem">
      <lr-color-picker label="Overlay tint" value=${`${ACCENT}${HALF_ALPHA}`} opacity open></lr-color-picker>
    </div>
  `,
};

/** `swatches` accepts a `;`-separated string, an array of colours, or `{ color, label }` objects. */
export const Swatches: StoryObj = {
  render: () => html`
    <div style="block-size: 24rem">
      <lr-color-picker
        label="Brand palette"
        value=${ACCENT}
        swatches=${[ACCENT, SUCCESS, GEMSTONES.topaz.fill, DANGER, GEMSTONES.amethyst.fill, 'rebeccapurple'].join(
          '; ',
        )}
        open
      ></lr-color-picker>
    </div>
  `,
};

export const ScopedSelectedSwatchTheme: StoryObj = {
  name: 'Scoped selected-swatch theme',
  render: () => html`
    <div style="block-size:24rem">
      <lr-color-picker
        label="Brand palette"
        value=${ACCENT}
        swatches=${[ACCENT, SUCCESS, DANGER].join('; ')}
        open
        style="--lr-color-picker-selected-border: var(--lr-color-danger); --lr-color-picker-selected-check-color: var(--lr-color-on-danger)"
      ></lr-color-picker>
    </div>
  `,
};

/** `placement` picks the preferred side; the resolved side still flips to stay in the viewport. */
export const Placement: StoryObj = {
  render: () => html`
    <div style="display: flex; gap: 4rem; padding-block: 8rem">
      <lr-color-picker label="Top" placement="top-start" value=${DANGER}></lr-color-picker>
      <lr-color-picker label="Right" placement="right-start" value=${SUCCESS}></lr-color-picker>
    </div>
  `,
};

/** `size` spans the same `2xs`–`xl` scale as `lr-input`, default `m`. */
export const Sizes: StoryObj = {
  render: () => {
    const sizes: LyraColorPickerSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem">
        ${sizes.map((size) => html`<lr-color-picker size=${size} label=${`Size "${size}"`}></lr-color-picker>`)}
      </div>
    `;
  },
};

/** 320px allocation with long field chrome, used by responsive visual coverage. */
export const Narrow: StoryObj = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-color-picker
        label="Choose the organization-wide visualization accent color"
        hint="This color is reused across charts, status summaries, and exported reports."
      ></lr-color-picker>
    </div>
  `,
};

/** Right-to-left mirrors the grid tint, the hue ramp, and the arrow-key semantics. */
export const RightToLeft: StoryObj = {
  render: () => html`
    <div dir="rtl" style="block-size: 20rem">
      <lr-color-picker label="لون التمييز" value=${ACCENT} open></lr-color-picker>
    </div>
  `,
};
