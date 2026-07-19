import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './time-input.js';

const meta: Meta = { title: 'Input/Time input', component: 'lr-time-input', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-time-input label="Start time" value="09:30"></lr-time-input>` };

/** `min`/`max` take the native `<input type="time">` literal form, as attributes or as properties. */
export const Bounded: StoryObj = {
  render: () => html`
    <lr-time-input
      label="Office hours"
      hint="Between 09:00 and 17:00"
      min="09:00"
      max="17:00"
      value="09:30"
    ></lr-time-input>
  `,
};
