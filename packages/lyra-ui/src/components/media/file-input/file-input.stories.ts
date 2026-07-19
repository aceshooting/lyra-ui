import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'FileInput',
  component: 'lr-file-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-file-input multiple accept=".csv,.xlsx"></lr-file-input>`,
};

export const CustomSlotContent: Story = {
  render: () =>
    html`<lr-file-input multiple accept=".csv,.xlsx" label="Upload spreadsheets">
      <strong>Drag spreadsheets here</strong>
      <span>or click to browse (.csv, .xlsx)</span>
    </lr-file-input>`,
};

export const AccessibleNameOverride: Story = {
  render: () => html`
    <lr-file-input aria-label="Upload supporting documents" multiple>
      <strong aria-hidden="true">＋</strong>
    </lr-file-input>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-file-input disabled accept=".csv,.xlsx"></lr-file-input>`,
};
