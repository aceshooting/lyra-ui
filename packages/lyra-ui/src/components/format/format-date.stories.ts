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
