import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Stat',
  component: 'lr-stat',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" trend="3.2" variant="success"></lr-stat>
      <lr-stat label="Errors" value="128" trend="-5.1" variant="danger"></lr-stat>
      <lr-stat label="Pending Reviews" value="42" trend="8.6" variant="warning"></lr-stat>
      <lr-stat label="Sessions" value="9,204"></lr-stat>
      <lr-stat label="Uptime" value="99.98" unit="%" caption="Last 30 days">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9"></circle>
        </svg>
      </lr-stat>
      <lr-stat label="Latency" value="182" unit="ms" trend="14" good-direction="down">
        <span slot="caption">Median over <strong>1,000</strong> requests</span>
      </lr-stat>
    </div>
  `,
};

export const SparkAndBreakdown: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" trend="3.2" variant="success" caption="Last 30 days">
        <lr-sparkline
          slot="spark"
          type="line"
          .values=${[4, 6, 5, 8, 7, 9, 12, 10, 13, 12.4]}
        ></lr-sparkline>
      </lr-stat>
      <lr-stat label="Sessions" value="9,204" caption="By channel">
        <lr-sparkline slot="spark" type="bar" .values=${[3, 5, 4, 6, 8, 7, 9]}></lr-sparkline>
      </lr-stat>
    </div>
  `,
};

export const BreakdownRows: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Sessions" value="9,204" caption="By channel"></lr-stat>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('lr-stat') as HTMLElement & {
      rows: { label: string; value: string }[];
    };
    el.rows = [
      { label: 'Direct', value: '64%' },
      { label: 'Referral', value: '21%' },
      { label: 'Other', value: '15%' },
    ];
  },
};

export const BreakdownRowsWithExactValue: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Usage" value="12,480" caption="By model, this billing cycle"></lr-stat>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('lr-stat') as HTMLElement & {
      rows: { label: string; value: string; exactValue?: string }[];
    };
    el.rows = [
      { label: 'Sonnet tokens', value: '8.4K', exactValue: '8,412 tokens' },
      { label: 'Haiku tokens', value: '3.1K', exactValue: '3,068 tokens' },
      { label: 'Cache reads', value: '980' },
    ];
  },
};

export const Emphasis: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" trend="3.2" emphasis></lr-stat>
      <lr-stat label="Errors" value="128" trend="-5.1" variant="danger" emphasis></lr-stat>
    </div>
  `,
};

export const LinkedKpi: Story = {
  render: () => html`
    <lr-stat
      label="Memories"
      value="128"
      caption="Open the memory inventory"
      href="?path=/story/stat--linked-kpi"
    ></lr-stat>
  `,
};

export const Appearance: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat label="Revenue" value="12.4" unit="k€" trend="3.2" caption="Last 30 days"></lr-stat>
      <lr-stat
        appearance="plain"
        label="Revenue"
        value="12.4"
        unit="k€"
        trend="3.2"
        caption="Last 30 days"
      ></lr-stat>
      <lr-stat
        appearance="plain"
        label="Memories"
        value="128"
        caption="Hover or tab to me — a plain link underlines its value instead of shifting a border it no longer has"
        href="?path=/story/stat--appearance"
      ></lr-stat>
    </div>
  `,
};

export const Orientation: Story = {
  render: () => html`
    <div class="flex flex-col gap-4">
      <lr-stat
        orientation="horizontal"
        label="Checks"
        value="87"
        unit="/100"
        trend="4.2"
        caption="42 of 48 clean"
      ></lr-stat>
      <!-- The acceptance shape: chrome-less, single baseline row, no label box. -->
      <lr-stat
        appearance="plain"
        orientation="horizontal"
        value="87"
        unit="/100"
        caption="42 of 48 clean"
      ></lr-stat>
      <!-- rows/spark have no place on a text baseline: they stay stacked below the row. -->
      <lr-stat
        orientation="horizontal"
        label="Sessions"
        value="9,204"
        caption="By channel"
        .rows=${[
          { label: 'Direct', value: '64%' },
          { label: 'Referral', value: '21%' },
          { label: 'Other', value: '15%' },
        ]}
      >
        <lr-sparkline slot="spark" type="bar" .values=${[3, 5, 4, 6, 8, 7, 9]}></lr-sparkline>
      </lr-stat>
    </div>
  `,
};

export const ExactValueSubProseCompact: Story = {
  render: () => html`
    <div class="flex flex-wrap gap-4">
      <lr-stat
        label="Revenue"
        value="$1.2K"
        exact-value="$1,204.37"
        sub="vs. last week"
        caption="Updated 2h ago"
        trend="3.2"
        variant="success"
      ></lr-stat>
      <lr-stat label="Status" prose value="Waiting for the next sync…"></lr-stat>
      <lr-stat label="Sessions" value="9,204" sub="+312 today" compact></lr-stat>
    </div>
  `,
};
