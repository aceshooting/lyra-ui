import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './country-picker.js';

const meta: Meta = { title: 'Forms/Country Picker', component: 'lr-country-picker' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-country-picker label="Country" value="LU"></lr-country-picker>`,
};
export const Searchable: Story = {
  render: () => html`<lr-country-picker searchable clearable label="Country" hint="Search by name or code"></lr-country-picker>`,
};
export const Configured: Story = {
  render: () => html`<lr-country-picker searchable label="Delivery country" value="LU" .countries=${[
    { code: 'LU', group: 'Common' }, { code: 'FR', group: 'Common' },
    { code: 'LB', group: 'More destinations' }, { code: 'US', group: 'More destinations', disabled: true },
  ]}></lr-country-picker>`,
};
export const WithoutFlags: Story = {
  render: () => html`<lr-country-picker label="Country" .flags=${false} value="LB"></lr-country-picker>`,
};
export const NarrowRtl: Story = {
  render: () => html`<div dir="rtl" lang="ar" style="inline-size: 280px"><lr-country-picker searchable label="البلد" value="LB"></lr-country-picker></div>`,
};
