import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './known-date.js';

const meta: Meta = {
  title: 'Forms/KnownDate',
  component: 'lr-known-date',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-known-date label="Birth date" hint="For example, 27 3 2007"></lr-known-date>
  `,
};

export const PrefilledValue: Story = {
  render: () => html`
    <lr-known-date label="Birth date" value="2007-03-27"></lr-known-date>
  `,
};

export const RequiredWithValidation: Story = {
  render: () => html`
    <lr-known-date label="Birth date" hint="For example, 27 3 2007" required></lr-known-date>
  `,
};

export const PassportDateRange: Story = {
  render: () => html`
    <lr-known-date
      label="Passport issue date"
      hint="Must be within the last 10 years"
      min="2016-01-01"
      max="2026-07-16"
    ></lr-known-date>
  `,
};

export const LocaleFieldOrder: Story = {
  render: () => html`
    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
      <lr-known-date label="Date of birth" locale="en-US" value="2007-03-27"></lr-known-date>
      <lr-known-date label="生年月日" locale="ja-JP" value="2007-03-27"></lr-known-date>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
      <lr-known-date size="xs" label="Extra small" value="2007-03-27"></lr-known-date>
      <lr-known-date size="s" label="Small" value="2007-03-27"></lr-known-date>
      <lr-known-date size="m" label="Medium (default)" value="2007-03-27"></lr-known-date>
      <lr-known-date size="l" label="Large" value="2007-03-27"></lr-known-date>
      <lr-known-date size="xl" label="Extra large" value="2007-03-27"></lr-known-date>
    </div>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-known-date
        label="تاريخ الميلاد"
        day-label="اليوم"
        month-label="الشهر"
        year-label="السنة"
        value="2007-03-27"
      ></lr-known-date>
    </div>
  `,
};
