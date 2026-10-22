import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chart-3d.js';
import type { LyraChart3dColumns } from './chart-3d.class.js';

const meta: Meta = {
  title: 'Charts/Chart 3D',
  component: 'lr-chart-3d',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

const samples: LyraChart3dColumns = {
  ids: ['north', 'east', 'south'],
  labels: ['North sample', 'East sample', 'South sample'],
  x: new Float32Array([1, 4, 2]),
  y: new Float32Array([3, 1, 4]),
  z: new Float32Array([2, 5, 1]),
  size: new Float32Array([12, 20, 16]),
  category: new Uint16Array([0, 1, 0]),
  categories: ['Control', 'Treatment'],
};

/** A spiral of rows in source order, with a category and a bubble diameter per row. */
function spiral(count: number): LyraChart3dColumns {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const size = new Float32Array(count);
  const category = new Uint16Array(count);
  for (let index = 0; index < count; index++) {
    const turn = index / 12;
    const radius = 1 + index / count;
    x[index] = Math.cos(turn) * radius;
    y[index] = (index / count) * 10;
    z[index] = Math.sin(turn) * radius;
    size[index] = 6 + (index % 5) * 4;
    category[index] = index % 3;
  }
  return {
    ids: Array.from({ length: count }, (_, index) => `sample-${index}`),
    labels: Array.from({ length: count }, (_, index) => `Sample ${index + 1}`),
    x, y, z, size, category,
    categories: ['Control', 'Treatment', 'Placebo'],
  };
}

/** The default is the accessible table: nothing is downloaded and every row is reachable by keyboard. */
export const Default: Story = {
  render: () => html`<lr-chart-3d label="Sample measurements" .data=${samples}
    .xAxis=${{ label: 'Distance', unit: 'km' }} .yAxis=${{ label: 'Height', unit: 'm' }} .zAxis=${{ label: 'Time', unit: 's' }}></lr-chart-3d>`,
};

/** Bubble charts add the diameter column; categories keep their names. */
export const Bubble: Story = {
  render: () => html`<lr-chart-3d label="Sample measurements" type="bubble" selected-id="east" .data=${samples}></lr-chart-3d>`,
};

/** Hidden categories leave the view without changing the identity or source index of the remaining rows. */
export const HiddenCategories: Story = {
  render: () => html`<lr-chart-3d label="Treatment only" .data=${samples} .hiddenCategories=${new Set([0])}></lr-chart-3d>`,
};

/** The table shows 200 rows per page while the keyboard cursor reaches every row. */
export const Paged: Story = {
  render: () => html`<lr-chart-3d label="Four hundred and fifty samples" .data=${spiral(450)}></lr-chart-3d>`,
};

/** Explicit opt-in loads the optional points renderer; unsupported environments keep the table. */
export const Scatter: Story = {
  render: () => html`<lr-chart-3d label="Spiral samples" engine="webgl" .data=${spiral(2000)}
    .xAxis=${{ label: 'East', unit: 'm' }} .yAxis=${{ label: 'Height', unit: 'm' }} .zAxis=${{ label: 'North', unit: 'm' }}></lr-chart-3d>`,
};

export const WebGLBubble: Story = {
  render: () => html`<lr-chart-3d label="Spiral samples by size" type="bubble" engine="webgl" .data=${spiral(400)}></lr-chart-3d>`,
};

/** Lines join adjacent rows in source order, independent of category. */
export const Line: Story = {
  render: () => html`<lr-chart-3d label="Spiral path" type="line" engine="webgl" .data=${spiral(600)}></lr-chart-3d>`,
};

/** A narrow right-to-left allocation with long axis names: the controls reflow and the table scrolls. */
export const NarrowRtl: Story = {
  render: () => html`<div dir="rtl" style="inline-size:320px;max-inline-size:100%"><lr-chart-3d
    label="Long localized measurement descriptions" type="bubble" .data=${samples}
    .xAxis=${{ label: 'Very long distance axis description', unit: 'kilometres' }}></lr-chart-3d></div>`,
};
