import type { LyraSpatialChartSource, LyraSpatialChartPoint } from '../../../utilities/data-spatial.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraChartPoint, LyraChartSeries } from './chart.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Bubble',
  component: 'lr-bubble-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const bubblePoints: LyraChartPoint[] = [
      { x: 10, y: 20, r: 8, id: 'north', label: 'North cluster' },
      { x: 15, y: 10, r: 12, id: 'central', label: 'Central cluster' },
      { x: 20, y: 30, r: 6, id: 'south', label: 'South cluster' },
    ];
    const series: LyraChartSeries[] = [
      { label: 'Clusters', points: bubblePoints },
    ];
    return html`
      <lr-bubble-chart
        height="16rem"
        style="width: 22rem"
        .datasets=${series}
      ></lr-bubble-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete bubble controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const bubblePoints: LyraChartPoint[] = [
      { x: 10, y: 20, r: 8, label: 'Northern production cluster' },
      { x: 15, y: 10, r: 12, label: 'Central production cluster' },
      { x: 20, y: 30, r: 6, label: 'Southern production cluster' },
    ];
    const series: LyraChartSeries[] = [{ label: 'Capacity by production deployment cluster', points: bubblePoints }];
    return narrowChartStory(html`
      <lr-bubble-chart
        aria-label="Capacity by production deployment cluster"
        height="16rem"
        legend-position="start"
        .datasets=${series}
      ></lr-bubble-chart>
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
    return html`<lr-bubble-chart height="20rem" with-data-table .preparedData=${source} .selectedPointId=${'5050'}></lr-bubble-chart>`;
  },
};
