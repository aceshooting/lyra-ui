import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './format-date.js';

const meta: Meta = { title: 'Utilities/Format date', component: 'lr-format-date', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-format-date date="2024-01-01"></lr-format-date>` };
export const UtcCalendarDate: StoryObj = {
  render: () => html`
    <lr-format-date date="2024-01-01T00:30:00Z" date-style="full" time-zone="UTC"></lr-format-date>
  `,
};
export const DateAndTime: StoryObj = {
  render: () => html`
    <lr-format-date
      date="2024-01-01T20:30:45Z"
      weekday="short"
      year="numeric"
      month="long"
      day="numeric"
      hour="2-digit"
      minute="2-digit"
      time-zone-name="short"
      time-zone="UTC"
      hour-format="24"
    ></lr-format-date>
  `,
};
