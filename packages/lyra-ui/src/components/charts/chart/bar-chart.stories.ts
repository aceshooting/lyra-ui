import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../forms/slider/slider.js';
import type { LyraChartSeries } from './chart.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Bar',
  component: 'lr-bar-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: LyraChartSeries[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-bar-chart
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-bar-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete bar controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const series: LyraChartSeries[] = [
      { label: 'Revenue from subscriptions and professional services', data: [12, 19, 14, 22] },
    ];
    return narrowChartStory(html`
      <lr-bar-chart
        aria-label="Quarterly revenue from subscriptions and professional services"
        height="16rem"
        legend-position="start"
        .labels=${['First quarter', 'Second quarter', 'Third quarter', 'Fourth quarter']}
        .datasets=${series}
      ></lr-bar-chart>
    `);
  },
};

/** Slider values denote bin edges: [0, 12] contains all twelve monthly bars. */
export const MonthlyRange: Story = {
  args: { direction: 'ltr' },
  argTypes: { direction: { control: 'radio', options: ['ltr', 'rtl'] } },
  render: (args) => {
    const rtl = args['direction'] === 'rtl';
    const months = Array.from({ length: 12 }, (_, month) =>
      new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month))));
    const counts = [4, 8, 5, 9, 14, 20, 18, 15, 12, 8, 6, 4];
    return html`
      <div dir=${rtl ? 'rtl' : 'ltr'} style="inline-size:100%;max-inline-size:var(--lr-size-28rem);display:grid;gap:var(--lr-space-xs)">
        <lr-bar-chart label="Monthly trips" compact without-legend without-animation height="64px"
          .labels=${rtl ? [...months].reverse() : months}
          .datasets=${[{ label: 'Trips', data: rtl ? [...counts].reverse() : counts }]}></lr-bar-chart>
        <lr-slider label="Included months" range min="0" max="12" step="1" min-value="0" max-value="12"
          show-value value-display="formatted" value-placement="label"
          .valueFormatter=${(value: number, handle: string) => months[Math.max(0, Math.min(11, handle === 'max' ? value - 1 : value))]}></lr-slider>
      </div>
    `;
  },
};

export const DenseHistory: Story = {
  render: () => html`
    <lr-bar-chart label="Twenty years of monthly counts" compact without-legend without-animation height="48px"
      style="inline-size:100%;max-inline-size:340px;--border-color-1:transparent"
      .labels=${Array.from({ length: 240 }, (_, index) => `Month ${index + 1}`)}
      .datasets=${[{ label: 'Count', data: Array.from({ length: 240 }, (_, index) => index % 8 + 1) }]}
      .config=${{ options: { datasets: { bar: { borderWidth: 0, borderRadius: 0 } } } }}></lr-bar-chart>
  `,
};
