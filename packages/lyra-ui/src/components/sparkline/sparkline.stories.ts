import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const DATA = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];

const meta: Meta = {
  title: 'Sparkline',
  component: 'lyra-sparkline',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Line: Story = {
  render: () => html`<lyra-sparkline type="line" .values=${DATA}></lyra-sparkline>`,
};

export const Area: Story = {
  render: () => html`<lyra-sparkline type="area" .values=${DATA}></lyra-sparkline>`,
};

export const Bar: Story = {
  render: () => html`<lyra-sparkline type="bar" .values=${DATA}></lyra-sparkline>`,
};

export const ExplicitRange: Story = {
  render: () => html`
    <lyra-sparkline type="bar" .values=${[20, 40, 30]} min="0" max="100"></lyra-sparkline>
    <lyra-sparkline type="bar" .values=${[70, 90, 80]} min="0" max="100"></lyra-sparkline>
  `,
};

export const NoData: Story = {
  render: () => html`<lyra-sparkline></lyra-sparkline>`,
};

export const AccessibleLabel: Story = {
  render: () => html`
    <lyra-sparkline
      aria-label="Revenue over the last quarter"
      .values=${[72, 78, 75, 84, 91]}
    ></lyra-sparkline>
  `,
};

export const FlatData: Story = {
  render: () => html`
    <lyra-sparkline type="line" .values=${[5, 5, 5, 5]}></lyra-sparkline>
    <lyra-sparkline type="area" .values=${[5, 5, 5, 5]}></lyra-sparkline>
    <lyra-sparkline type="bar" .values=${[5, 5, 5, 5]}></lyra-sparkline>
  `,
};

export const SingleValue: Story = {
  render: () => html`
    <lyra-sparkline type="line" .values=${[5]}></lyra-sparkline>
    <lyra-sparkline type="bar" .values=${[5]}></lyra-sparkline>
  `,
};
