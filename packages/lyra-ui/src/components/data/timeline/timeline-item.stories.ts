import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './timeline.js';
import './timeline-item.js';

const meta: Meta = {
  title: 'Timeline/Item',
  component: 'lr-timeline-item',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-timeline aria-label="Deployment history">
      <lr-timeline-item variant="success" active>Deployment completed</lr-timeline-item>
    </lr-timeline>
  `,
};
