import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-counter.js';

const meta: Meta = {
  title: 'Utility/Counter',
  component: 'lr-counter',
  tags: ['autodocs'],
};

export default meta;

const inDays = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();

export const Default: StoryObj = {
  render: () => html`<lr-counter label="Sale ends" date=${inDays(3)}></lr-counter>`,
};

export const Clock: StoryObj = {
  render: () => html`<lr-counter label="Doors open" without-labels delimiter=":" date=${inDays(1)}></lr-counter>`,
};

export const CountUp: StoryObj = {
  render: () => html`<lr-counter label="Uptime" direction="up" date=${inDays(-2)} format="short"></lr-counter>`,
};

export const Finished: StoryObj = {
  render: () => html`<lr-counter label="Launch" duration="5000"><strong slot="finished">We are live</strong></lr-counter>`,
};

export const LargestUnit: StoryObj = {
  render: () => html`<lr-counter label="Remaining" largest-unit="hours" smallest-unit="minutes" date=${inDays(2)}></lr-counter>`,
};

export const Rtl: StoryObj = {
  render: () => html`<div dir="rtl"><lr-counter lang="ar" label="العد التنازلي" date=${inDays(3)}></lr-counter></div>`,
};
