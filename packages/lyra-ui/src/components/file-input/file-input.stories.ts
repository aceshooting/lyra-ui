import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'FileInput',
  component: 'lyra-file-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-file-input multiple accept=".csv,.xlsx"></lyra-file-input>`,
};

export const CustomSlotContent: Story = {
  render: () =>
    html`<lyra-file-input multiple accept=".csv,.xlsx" label="Upload spreadsheets">
      <strong>Drag spreadsheets here</strong>
      <span>or click to browse (.csv, .xlsx)</span>
    </lyra-file-input>`,
};

export const AccessibleNameOverride: Story = {
  render: () => html`
    <lyra-file-input aria-label="Upload supporting documents" multiple>
      <strong aria-hidden="true">＋</strong>
    </lyra-file-input>
  `,
};

export const Disabled: Story = {
  render: () => html`<lyra-file-input disabled accept=".csv,.xlsx"></lyra-file-input>`,
};
