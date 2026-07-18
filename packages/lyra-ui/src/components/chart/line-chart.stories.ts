import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from './chart.js';
import { storyColor } from '../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Charts/Line',
  component: 'lr-line-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
      { label: 'Sessions', data: [4, 7, 6, 9, 12], fill: true },
      { label: 'Errors', data: [1, 2, 1, 0, 3], color: storyColor('danger') },
    ];
    return html`
      <lr-line-chart
        height="16rem"
        style="width: 22rem"
        legend
        .labels=${['Jan', 'Feb', 'Mar', 'Apr', 'May']}
        .datasets=${series}
      ></lr-line-chart>
    `;
  },
};

/**
 * `area` fills every series lacking its own per-series `fill` (unlike
 * `Default`'s "Sessions" series, which opts into a fill via its own
 * `fill: true` instead of the chart-wide default).
 */
export const AreaFill: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Sessions', data: [4, 7, 6, 9, 12] }];
    return html`
      <lr-line-chart
        area
        height="16rem"
        style="width: 22rem"
        .labels=${['Jan', 'Feb', 'Mar', 'Apr', 'May']}
        .datasets=${series}
      ></lr-line-chart>
    `;
  },
};

/** `zoom` enables wheel/drag/pinch zoom; a reset-zoom button appears once zoomed. */
export const WithZoom: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Sessions', data: [4, 7, 6, 9, 12, 8, 15, 10, 6, 9] }];
    return html`
      <lr-line-chart
        zoom
        height="16rem"
        style="width: 22rem"
        .labels=${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O']}
        .datasets=${series}
        @lr-zoom=${(e: CustomEvent) => console.log('lr-zoom', e.detail)}
      ></lr-line-chart>
    `;
  },
};

/** A second series on `axis: "y2"` plots against its own right-side scale, labelled by `y2-label`. */
export const DualAxis: Story = {
  render: () => {
    const series: Series[] = [
      { label: 'Sessions', data: [40, 70, 60, 90, 120] },
      { label: 'Conversion rate', data: [0.02, 0.03, 0.025, 0.04, 0.05], axis: 'y2' },
    ];
    return html`
      <lr-line-chart
        legend
        height="16rem"
        style="width: 22rem"
        y-label="Sessions"
        y2-label="Conversion rate"
        .labels=${['Jan', 'Feb', 'Mar', 'Apr', 'May']}
        .datasets=${series}
      ></lr-line-chart>
    `;
  },
};

/**
 * `beginAtZero` lets the y axis start near the data's own minimum instead of
 * 0 — set via the `.beginAtZero` property, since the `begin-at-zero`
 * *attribute*'s presence (not its string value) is what Lit's boolean
 * converter reads, so `begin-at-zero="false"` would not turn it off.
 */
export const WithoutBeginAtZero: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Temperature (°C)', data: [18, 19, 21, 20, 22] }];
    return html`
      <lr-line-chart
        height="16rem"
        style="width: 22rem"
        .beginAtZero=${false}
        .labels=${['Jan', 'Feb', 'Mar', 'Apr', 'May']}
        .datasets=${series}
      ></lr-line-chart>
    `;
  },
};
