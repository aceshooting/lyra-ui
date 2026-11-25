import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-radial-bar.js';

const meta: Meta = {
  title: 'Data Display/Radial Bar',
  component: 'lr-radial-bar',
  tags: ['autodocs'],
};

export default meta;

const BROWSERS = [
  { label: 'Chrome', value: 275 },
  { label: 'Safari', value: 200 },
  { label: 'Firefox', value: 187 },
  { label: 'Edge', value: 90 },
];

export const Default: StoryObj = {
  render: () => html`<lr-radial-bar label="Visitors by browser" max="300" with-legend .segments=${BROWSERS}></lr-radial-bar>`,
};

/** Without a legend the drawing stands alone; the list stays available to assistive technology. */
export const WithoutLegend: StoryObj = {
  render: () => html`<lr-radial-bar label="Visitors by browser" .segments=${BROWSERS} style="--lr-radial-bar-size: 8rem"></lr-radial-bar>`,
};

/** Each segment can carry its own `max` and a semantic `variant`. */
export const GoalsWithVariants: StoryObj = {
  render: () => html`<lr-radial-bar
    label="Quarterly goals"
    with-legend
    .segments=${[
      { label: 'Revenue', value: 1.8, max: 2, variant: 'success' },
      { label: 'New customers', value: 140, max: 250, variant: 'warning' },
      { label: 'Churned accounts', value: 12, max: 10, variant: 'danger' },
    ]}
  ></lr-radial-bar>`,
};

/** Exact 320px allocation: the legend stacks under the drawing. */
export const Narrow320: StoryObj = {
  render: () => html`<lr-radial-bar
    label="Visitors by browser"
    with-legend
    max="300"
    style="inline-size: 320px; max-inline-size: 100%"
    .segments=${BROWSERS}
  ></lr-radial-bar>`,
};

export const RightToLeft: StoryObj = {
  render: () => html`<div dir="rtl" lang="ar">
    <lr-radial-bar label="Visitors by browser" max="300" with-legend .segments=${BROWSERS}></lr-radial-bar>
  </div>`,
};
