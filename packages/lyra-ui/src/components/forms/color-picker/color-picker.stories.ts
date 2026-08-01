import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraColorPickerSize, LyraColorPickerFormat } from './color-picker.js';
import './color-picker.js';
const meta: Meta = { title: 'Form/Color picker', component: 'lr-color-picker', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-color-picker label="Accent color"></lr-color-picker>` };

/** The panel carries the saturation/brightness grid, the hue slider, the value field, the format
 *  toggle, and — where the browser exposes the EyeDropper API — a screen picker. */
export const Open: StoryObj = {
  render: () => html`
    <div style="block-size: 20rem">
      <lr-color-picker label="Accent color" value="#3366ff" open></lr-color-picker>
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
            value="#3366ff"
          ></lr-color-picker>`,
        )}
      </div>
    `;
  },
};

/** `uppercase` serializes the same colour in upper case. */
export const Uppercase: StoryObj = {
  render: () => html`<lr-color-picker label="Accent color" value="#3366ff" uppercase></lr-color-picker>`,
};

/** `opacity` adds the alpha slider and an alpha-carrying value (`#rrggbbaa`, `rgba()`, ...). */
export const Opacity: StoryObj = {
  render: () => html`
    <div style="block-size: 20rem">
      <lr-color-picker label="Overlay tint" value="#3366ff80" opacity open></lr-color-picker>
    </div>
  `,
};

/** `swatches` accepts a `;`-separated string, an array of colours, or `{ color, label }` objects. */
export const Swatches: StoryObj = {
  render: () => html`
    <div style="block-size: 24rem">
      <lr-color-picker
        label="Brand palette"
        value="#0969da"
        swatches="#0969da; #1a7f37; #9a6700; #cf222e; #8250df; rebeccapurple"
        open
      ></lr-color-picker>
    </div>
  `,
};

/** `placement` picks the preferred side; the resolved side still flips to stay in the viewport. */
export const Placement: StoryObj = {
  render: () => html`
    <div style="display: flex; gap: 4rem; padding-block: 8rem">
      <lr-color-picker label="Top" placement="top-start" value="#cf222e"></lr-color-picker>
      <lr-color-picker label="Right" placement="right-start" value="#1a7f37"></lr-color-picker>
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
      <lr-color-picker label="لون التمييز" value="#3366ff" open></lr-color-picker>
    </div>
  `,
};
