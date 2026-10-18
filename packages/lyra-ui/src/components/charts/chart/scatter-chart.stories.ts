import type { LyraSpatialChartSource, LyraSpatialChartPoint } from '../../../utilities/data-spatial.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraChartSeries } from './chart.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Scatter',
  component: 'lr-scatter-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: LyraChartSeries[] = [
      {
        label: 'Samples',
        points: [
          { x: 10, y: 20 },
          { x: 15, y: 10 },
          { x: 20, y: 30 },
          { x: 25, y: 15 },
        ],
      },
    ];
    return html`
      <lr-scatter-chart
        height="16rem"
        style="width: 22rem"
        x-label="X value"
        y-label="Y value"
        .datasets=${series}
      ></lr-scatter-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete scatter controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const series: LyraChartSeries[] = [
      {
        label: 'Request duration samples across production deployment cohorts',
        points: [
          { x: 10, y: 20 },
          { x: 15, y: 10 },
          { x: 20, y: 30 },
          { x: 25, y: 15 },
        ],
      },
    ];
    return narrowChartStory(html`
      <lr-scatter-chart
        aria-label="Request duration samples across production deployment cohorts"
        height="16rem"
        legend-position="start"
        x-label="End-to-end request duration"
        y-label="Completed requests"
        .datasets=${series}
      ></lr-scatter-chart>
    `);
  },
};

/** Host-owned indexed grid with complete density and bounded exact-point overlays. */
export const SpatialDensity: Story = {
  render: () => {
    const point = (index: number): LyraSpatialChartPoint => ({ id: String(index), sourceIndex: index, seriesId: 'grid', x: index % 100, y: Math.floor(index / 100), radius: 1 + index % 10 });
    const source: LyraSpatialChartSource = {
      kind: 'spatial', revision: 'grid', count: 10000,
      bounds: { minX: 0, maxX: 99, minY: 0, maxY: 99 },
      series: [{ id: 'grid', label: 'Indexed grid' }], radiusDomain: { min: 1, max: 10 },
      query: ({ bounds, maxPoints }) => {
        const minX = Math.ceil(bounds.minX), maxX = Math.floor(bounds.maxX), minY = Math.ceil(bounds.minY), maxY = Math.floor(bounds.maxY);
        const matchedCount = Math.max(0, maxX - minX + 1) * Math.max(0, maxY - minY + 1);
        const first = minY * 100 + minX, last = maxY * 100 + maxX;
        const points = matchedCount ? [point(first), ...(last === first ? [] : [point(last)])].slice(0, maxPoints) : [];
        return { matchedCount, bins: matchedCount ? [{ bounds, count: matchedCount }] : [], points };
      },
      getPoint: id => { const index = Number(id); return String(index) === id && Number.isSafeInteger(index) && index >= 0 && index < 10000 ? point(index) : null; },
    };
    return html`<lr-scatter-chart height="20rem" with-data-table .preparedData=${source} .selectedPointId=${'5050'}></lr-scatter-chart>`;
  },
};
