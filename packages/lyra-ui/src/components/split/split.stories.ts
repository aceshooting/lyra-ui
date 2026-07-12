import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Split',
  component: 'lyra-split',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-split style="height: 8rem; border: 1px solid #ddd">
      <div style="padding: 0.5rem">Panel A</div>
      <div style="padding: 0.5rem">Panel B</div>
      <div style="padding: 0.5rem">Panel C</div>
    </lyra-split>
  `,
};

export const Vertical: Story = {
  render: () => html`
    <lyra-split orientation="vertical" style="height: 16rem; border: 1px solid #ddd">
      <div style="padding: 0.5rem">Panel A</div>
      <div style="padding: 0.5rem">Panel B</div>
      <div style="padding: 0.5rem">Panel C</div>
    </lyra-split>
  `,
};

export const FixedPixelRangePanel: Story = {
  render: () => html`
    <lyra-split
      style="height: 8rem; border: 1px solid #ddd"
      .panelConstraints=${[{ minPx: 160, maxPx: 320 }, null]}
    >
      <div style="padding: 0.5rem">Sidebar — pinned between 160px and 320px regardless of the split's own percent-based sizing or a container resize</div>
      <div style="padding: 0.5rem">Main content — fills the rest, percent-based as usual</div>
    </lyra-split>
  `,
};
