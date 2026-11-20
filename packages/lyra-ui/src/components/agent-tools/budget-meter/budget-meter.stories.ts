import { html } from 'lit';
import { formatBytes } from '../../../utilities/format.js';
import type { BudgetMeterValueFormatter } from './budget-meter.class.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../../lr-budget-meter.js';

const meta: Meta = {
  title: 'Agent Tools/Budget Meter',
  component: 'lr-budget-meter',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A presentation-only usage meter. The host supplies quantities and units; the component clamps only the painted fill and keeps actual values visible.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const WithinBudget: Story = {
  render: () => html`<lr-budget-meter style="max-inline-size: 36rem" used="72000" limit="100000" unit="tokens"></lr-budget-meter>`,
};

export const Exceeded: Story = {
  render: () => html`<lr-budget-meter style="max-inline-size: 36rem" used="125000" limit="100000" unit="tokens"></lr-budget-meter>`,
};

export const Unavailable: Story = {
  render: () => html`<lr-budget-meter style="max-inline-size: 36rem" used="1800" limit="0" unit="tokens"></lr-budget-meter>`,
};

export const NarrowRtl: Story = {
  render: () => html`<lr-budget-meter dir="rtl" style="inline-size: 320px" used="23000" limit="80000" .unit=${'وحدة طويلة '.repeat(8)}></lr-budget-meter>`,
};

const byteFormatter: BudgetMeterValueFormatter = (value, { locale }) =>
  formatBytes(value, locale, { unitStep: 1024, decimals: 2 }) ?? String(value);

/** Each quantity chooses its own byte scale; numeric ARIA remains in raw bytes. */
export const ByteQuantities: Story = {
  render: () => html`
    <lr-budget-meter style="max-inline-size: 36rem" label="Storage" used="1536" limit="1048576"
      .valueFormatter=${byteFormatter}></lr-budget-meter>
    <lr-budget-meter style="max-inline-size: 36rem" label="Raw storage" used="1536" limit="1048576"
      unit="bytes"></lr-budget-meter>
  `,
};

export const CompactFrame: Story = {
  render: () => html`<lr-budget-meter frame="plain" size="s" used="110" limit="100" unit="tokens"></lr-budget-meter>`,
};
