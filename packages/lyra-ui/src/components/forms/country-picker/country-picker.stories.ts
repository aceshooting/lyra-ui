import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import '../../lr-country-picker.js';

const meta: Meta = { title: 'Forms/Country Picker', component: 'lr-country-picker' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-country-picker label="Country" value="LU"></lr-country-picker>`,
};
export const Searchable: Story = {
  parameters: { docs: { description: { story: 'If the filter fails to load, a localized notice and Retry button appear below the compact picker.' } } },
  render: () => html`<lr-country-picker searchable clearable label="Country" hint="Search by name or code"></lr-country-picker>`,
};
export const InvalidBorder: Story = {
  render: () => html`<form style="--lr-form-control-invalid-border-color: var(--lr-color-brand)">
    <lr-country-picker required searchable label="Country"></lr-country-picker>
    <button type="submit">Check validity</button>
  </form>`,
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

export const InputLimit: StoryObj = {
  parameters: { docs: { description: { story: 'Catalog input loss is disclosed separately from the popup row window, including when repeated rows consume the inspected prefix.' } } },
  render: () => html`<lr-country-picker label="Bounded catalog" .countries=${Array.from({ length: 1025 }, () => 'US')}></lr-country-picker>`,
};

/** `label-placement="start"` sets the label in an inline-start column, with the hint under the
 *  field; below `--lr-form-control-label-collapse-inline-size` it returns above the field. */
export const LabelPlacementStart: StoryObj = {
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-m);max-inline-size:var(--lr-size-36rem)">
      <lr-country-picker label="Country" label-placement="start" hint="Where the parcel ships"></lr-country-picker>
    </div>
  `,
};
