import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './timeline.js';
import './timeline-item.js';

const meta: Meta = {
  title: 'Timeline',
  component: 'lr-timeline',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-timeline aria-label="Deployment history">
      <lr-timeline-item variant="success">Deployment completed</lr-timeline-item>
      <lr-timeline-item variant="brand" active>Integration tests are running</lr-timeline-item>
      <lr-timeline-item>Build queued</lr-timeline-item>
    </lr-timeline>
  `,
};

export const Horizontal: Story = {
  render: () => html`
    <lr-timeline orientation="horizontal" aria-label="Release stages">
      <lr-timeline-item variant="success">Build</lr-timeline-item>
      <lr-timeline-item variant="success">Test</lr-timeline-item>
      <lr-timeline-item variant="brand" active>Release</lr-timeline-item>
    </lr-timeline>
  `,
};
