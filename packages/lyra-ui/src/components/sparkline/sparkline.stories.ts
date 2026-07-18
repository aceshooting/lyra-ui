import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const DATA = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];

const meta: Meta = {
  title: 'Sparkline',
  component: 'lr-sparkline',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Line: Story = {
  render: () => html`<lr-sparkline type="line" .values=${DATA}></lr-sparkline>`,
};

export const Area: Story = {
  render: () => html`<lr-sparkline type="area" .values=${DATA}></lr-sparkline>`,
};

export const Bar: Story = {
  render: () => html`<lr-sparkline type="bar" .values=${DATA}></lr-sparkline>`,
};

export const ExplicitRange: Story = {
  render: () => html`
    <lr-sparkline type="bar" .values=${[20, 40, 30]} min="0" max="100"></lr-sparkline>
    <lr-sparkline type="bar" .values=${[70, 90, 80]} min="0" max="100"></lr-sparkline>
  `,
};

export const NoData: Story = {
  render: () => html`<lr-sparkline></lr-sparkline>`,
};

export const AccessibleLabel: Story = {
  render: () => html`
    <lr-sparkline
      aria-label="Revenue over the last quarter"
      .values=${[72, 78, 75, 84, 91]}
    ></lr-sparkline>
  `,
};

export const FlatData: Story = {
  render: () => html`
    <lr-sparkline type="line" .values=${[5, 5, 5, 5]}></lr-sparkline>
    <lr-sparkline type="area" .values=${[5, 5, 5, 5]}></lr-sparkline>
    <lr-sparkline type="bar" .values=${[5, 5, 5, 5]}></lr-sparkline>
  `,
};

export const SingleValue: Story = {
  render: () => html`
    <lr-sparkline type="line" .values=${[5]}></lr-sparkline>
    <lr-sparkline type="bar" .values=${[5]}></lr-sparkline>
  `,
};
