import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './known-date.js';

const meta: Meta = {
  title: 'Forms/KnownDate',
  component: 'lyra-known-date',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-known-date label="Birth date" hint="For example, 27 3 2007"></lyra-known-date>
  `,
};

export const PrefilledValue: Story = {
  render: () => html`
    <lyra-known-date label="Birth date" value="2007-03-27"></lyra-known-date>
  `,
};

export const RequiredWithValidation: Story = {
  render: () => html`
    <lyra-known-date label="Birth date" hint="For example, 27 3 2007" required></lyra-known-date>
  `,
};

export const PassportDateRange: Story = {
  render: () => html`
    <lyra-known-date
      label="Passport issue date"
      hint="Must be within the last 10 years"
      min="2016-01-01"
      max="2026-07-16"
    ></lyra-known-date>
  `,
};

export const LocaleFieldOrder: Story = {
  render: () => html`
    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
      <lyra-known-date label="Date of birth" locale="en-US" value="2007-03-27"></lyra-known-date>
      <lyra-known-date label="生年月日" locale="ja-JP" value="2007-03-27"></lyra-known-date>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
      <lyra-known-date size="xs" label="Extra small" value="2007-03-27"></lyra-known-date>
      <lyra-known-date size="s" label="Small" value="2007-03-27"></lyra-known-date>
      <lyra-known-date size="m" label="Medium (default)" value="2007-03-27"></lyra-known-date>
      <lyra-known-date size="l" label="Large" value="2007-03-27"></lyra-known-date>
      <lyra-known-date size="xl" label="Extra large" value="2007-03-27"></lyra-known-date>
    </div>
  `,
};

export const RightToLeft: Story = {
  render: () => html`
    <div dir="rtl">
      <lyra-known-date
        label="تاريخ الميلاد"
        day-label="اليوم"
        month-label="الشهر"
        year-label="السنة"
        value="2007-03-27"
      ></lyra-known-date>
    </div>
  `,
};
