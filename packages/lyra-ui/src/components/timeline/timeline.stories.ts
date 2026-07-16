import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './timeline.js';
import './timeline-item.js';

const meta: Meta = {
  title: 'Timeline',
  component: 'lyra-timeline',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-timeline aria-label="Deployment history">
      <lyra-timeline-item variant="success">Deployment completed</lyra-timeline-item>
      <lyra-timeline-item variant="brand" active>Integration tests are running</lyra-timeline-item>
      <lyra-timeline-item>Build queued</lyra-timeline-item>
    </lyra-timeline>
  `,
};

export const Horizontal: Story = {
  render: () => html`
    <lyra-timeline orientation="horizontal" aria-label="Release stages">
      <lyra-timeline-item variant="success">Build</lyra-timeline-item>
      <lyra-timeline-item variant="success">Test</lyra-timeline-item>
      <lyra-timeline-item variant="brand" active>Release</lyra-timeline-item>
    </lyra-timeline>
  `,
};
