import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraColorPickerSize } from './color-picker.js';
import './color-picker.js';
const meta: Meta = { title: 'Form/Color picker', component: 'lr-color-picker', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-color-picker label="Accent color"></lr-color-picker>` };

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
