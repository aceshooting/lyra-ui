import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './time-input.js';

const meta: Meta = {
  title: 'Input/Time input',
  component: 'lr-time-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-time-input label="Start time" value="09:30" with-clear with-now style="max-width: 20rem"></lr-time-input>
  `,
};

/** Locale controls the segment order, separators, digits, and day-period labels. */
export const LocalesAndHourFormats: Story = {
  render: () => html`
    <div style="display: grid; gap: 1rem; max-width: 24rem">
      <lr-time-input label="US, automatic" locale="en-US" value="17:45"></lr-time-input>
      <lr-time-input label="French, automatic" locale="fr-FR" value="17:45"></lr-time-input>
      <lr-time-input label="Arabic, forced 12-hour" locale="ar" hour-format="12" value="17:45"></lr-time-input>
      <lr-time-input label="Japanese, forced 24-hour" locale="ja" hour-format="24" value="17:45"></lr-time-input>
    </div>
  `,
};

/** A step below 60 seconds adds the seconds segment and picker column. */
export const Seconds: Story = {
  render: () => html`
    <lr-time-input label="Precise start" step="15" value="09:30:15" with-now style="max-width: 20rem"></lr-time-input>
  `,
};

/** Reversed bounds describe a valid range that crosses midnight. */
export const OvernightRange: Story = {
  render: () => html`
    <lr-time-input
      label="Night shift"
      hint="Choose a time from 22:00 through 06:00"
      min="22:00"
      max="06:00"
      step="300"
      value="23:30"
      required
      style="max-width: 20rem"
    ></lr-time-input>
  `,
};

export const InitiallyOpen: Story = {
  render: () => html`
    <lr-time-input label="Appointment time" value="13:15" with-now open style="max-width: 20rem"></lr-time-input>
  `,
};
