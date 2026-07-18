import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './scroller.js';

const meta: Meta = { title: 'Layout/Scroller', component: 'lr-scroller' };
export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  render: () => html`<lr-scroller controls label="Project cards" style="max-inline-size: 28rem;">
    ${['Solar', 'Wind', 'Battery', 'Forecast', 'Maintenance'].map((item) => html`<span style="display:inline-block; padding: var(--lr-space-l); background: var(--lr-color-brand-quiet);">${item}</span>`)}
  </lr-scroller>`,
};

export const Vertical: Story = {
  render: () => html`<lr-scroller orientation="vertical" controls label="Recent events" style="max-block-size: 12rem;">
    ${['Connected', 'Imported', 'Calculated', 'Published'].map((item) => html`<span>${item}</span>`)}
  </lr-scroller>`,
};
