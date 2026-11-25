import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-category-bar.js';

const meta: Meta = {
  title: 'Data Display/Category Bar',
  component: 'lr-category-bar',
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj = {
  render: () => html`<lr-category-bar
    label="Credit score"
    marker="72"
    with-labels
    .values=${[40, 30, 20, 10]}
    .variants=${['danger', 'warning', 'brand', 'success']}
    style="max-inline-size: 28rem"
  ></lr-category-bar>`,
};

/** Without a marker the group lists every range; without variants the chart palette applies. */
export const RangesOnly: StoryObj = {
  render: () => html`<lr-category-bar label="Response time budget" .values=${[200, 300, 500]} with-labels style="max-inline-size: 28rem"></lr-category-bar>`,
};

/** Exact 320px allocation keeps only the scale's two end values. */
export const Narrow320: StoryObj = {
  render: () => html`<lr-category-bar
    label="Credit score"
    marker="55"
    with-labels
    .values=${[10, 20, 30, 40]}
    style="inline-size: 320px; max-inline-size: 100%"
  ></lr-category-bar>`,
};

export const RightToLeft: StoryObj = {
  render: () => html`<div dir="rtl" lang="ar" style="max-inline-size: 28rem">
    <lr-category-bar label="Credit score" marker="72" with-labels .values=${[40, 30, 30]} .variants=${['danger', 'warning', 'success']}></lr-category-bar>
  </div>`,
};
