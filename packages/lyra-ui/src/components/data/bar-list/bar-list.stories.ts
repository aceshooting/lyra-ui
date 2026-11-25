import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-bar-list.js';

const meta: Meta = {
  title: 'Data Display/Bar List',
  component: 'lr-bar-list',
  tags: ['autodocs'],
};

export default meta;

const PAGES = [
  { label: '/pricing', value: 2_140 },
  { label: '/home', value: 8_920 },
  { label: '/docs/getting-started', value: 4_310 },
  { label: '/blog/release-notes', value: 1_280 },
  { label: '/careers', value: 390 },
];

export const Default: StoryObj = {
  render: () => html`<lr-bar-list label="Top pages" .items=${PAGES} style="max-inline-size: 28rem"></lr-bar-list>`,
};

/** Variants color individual rows; `max` fixes the scale instead of the largest value. */
export const VariantsAndMax: StoryObj = {
  render: () => html`<lr-bar-list
    label="Error budget consumed"
    max="100"
    .items=${[
      { label: 'Checkout API', value: 92, variant: 'danger' },
      { label: 'Search', value: 64, variant: 'warning' },
      { label: 'Profile service', value: 18, variant: 'success' },
    ]}
    .valueFormatter=${(value: number) => `${value}%`}
    style="max-inline-size: 28rem"
  ></lr-bar-list>`,
};

/** `sort="none"` keeps the caller's order. */
export const CallerOrder: StoryObj = {
  render: () => html`<lr-bar-list label="Top pages" sort="none" .items=${PAGES} style="max-inline-size: 28rem"></lr-bar-list>`,
};

/** Exact 320px allocation with long labels exercises the narrow container-query branch. */
export const Narrow320: StoryObj = {
  render: () => html`<lr-bar-list
    label="Referring sites"
    style="inline-size: 320px; max-inline-size: 100%"
    .items=${[
      { label: 'An extremely long referring domain name that has to wrap', value: 5_400 },
      { label: 'news.example.org', value: 1_200 },
    ]}
  ></lr-bar-list>`,
};

export const RightToLeft: StoryObj = {
  render: () => html`<div dir="rtl" lang="ar" style="max-inline-size: 28rem">
    <lr-bar-list label="Top pages" .items=${PAGES}></lr-bar-list>
  </div>`,
};
