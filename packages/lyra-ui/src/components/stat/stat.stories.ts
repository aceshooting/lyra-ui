import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Stat',
  component: 'lyra-stat',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lyra-stat label="Revenue" value="12.4" unit="k€" trend="3.2" variant="success"></lyra-stat>
      <lyra-stat label="Errors" value="128" trend="-5.1" variant="danger"></lyra-stat>
      <lyra-stat label="Pending Reviews" value="42" trend="8.6" variant="warning"></lyra-stat>
      <lyra-stat label="Sessions" value="9,204"></lyra-stat>
      <lyra-stat label="Uptime" value="99.98" unit="%" caption="Last 30 days">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9"></circle>
        </svg>
      </lyra-stat>
      <lyra-stat label="Latency" value="182" unit="ms" trend="14" good-direction="down">
        <span slot="caption">Median over <strong>1,000</strong> requests</span>
      </lyra-stat>
    </div>
  `,
};

export const SparkAndBreakdown: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lyra-stat label="Revenue" value="12.4" unit="k€" trend="3.2" variant="success" caption="Last 30 days">
        <lyra-sparkline
          slot="spark"
          type="line"
          .values=${[4, 6, 5, 8, 7, 9, 12, 10, 13, 12.4]}
        ></lyra-sparkline>
      </lyra-stat>
      <lyra-stat label="Sessions" value="9,204" caption="By channel">
        <lyra-sparkline slot="spark" type="bar" .values=${[3, 5, 4, 6, 8, 7, 9]}></lyra-sparkline>
      </lyra-stat>
    </div>
  `,
};

export const BreakdownRows: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lyra-stat label="Sessions" value="9,204" caption="By channel"></lyra-stat>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('lyra-stat') as HTMLElement & {
      rows: { label: string; value: string }[];
    };
    el.rows = [
      { label: 'Direct', value: '64%' },
      { label: 'Referral', value: '21%' },
      { label: 'Other', value: '15%' },
    ];
  },
};

export const Emphasis: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lyra-stat label="Revenue" value="12.4" unit="k€" trend="3.2" emphasis></lyra-stat>
      <lyra-stat label="Errors" value="128" trend="-5.1" variant="danger" emphasis></lyra-stat>
    </div>
  `,
};
