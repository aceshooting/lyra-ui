import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Split',
  component: 'lr-split',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-split style="height: 8rem; border: 1px solid var(--lr-color-border)">
      <div style="padding: 0.5rem">Panel A</div>
      <div style="padding: 0.5rem">Panel B</div>
      <div style="padding: 0.5rem">Panel C</div>
    </lr-split>
  `,
};

export const Vertical: Story = {
  render: () => html`
    <lr-split orientation="vertical" style="height: 16rem; border: 1px solid var(--lr-color-border)">
      <div style="padding: 0.5rem">Panel A</div>
      <div style="padding: 0.5rem">Panel B</div>
      <div style="padding: 0.5rem">Panel C</div>
    </lr-split>
  `,
};

export const FixedPixelRangePanel: Story = {
  render: () => html`
    <lr-split
      style="height: 8rem; border: 1px solid var(--lr-color-border)"
      .panelConstraints=${[{ minPx: 160, maxPx: 320 }, null]}
    >
      <div style="padding: 0.5rem">Sidebar — pinned between 160px and 320px regardless of the split's own percent-based sizing or a container resize</div>
      <div style="padding: 0.5rem">Main content — fills the rest, percent-based as usual</div>
    </lr-split>
  `,
};

export const ResponsiveCollapse: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 12rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)">
        Drag this box's bottom-right corner to shrink it. lr-split only
        handles the width-collapse mechanics (and signals the current state
        via the <code>data-collapse-state</code> attribute + the
        <code>lr-split-collapse-change</code> event) — below 640px the
        sidebar clamps to a fixed <code>rail-width</code>; below 400px it
        instead becomes a floating overlay card. The sidebar's own content is
        expected to adapt itself to the clamped width (e.g. via its own
        container query); this demo just swaps in a shorter label to keep it
        legible at rail width.
      </p>
      <lr-split
        collapse="start"
        rail-width="3.5rem"
        style="height: 12rem; border: 1px solid var(--lr-color-border)"
        @lr-split-collapse-change=${(e: CustomEvent<{ state: string }>) =>
          console.log('lr-split-collapse-change', e.detail.state)}
      >
        <div style="padding: 0.5rem; background: var(--lr-color-brand-quiet); overflow: hidden">
          Sidebar (collapse="start")
        </div>
        <div style="padding: 0.5rem">
          Main content — grows to fill whatever space the sidebar frees up
        </div>
      </lr-split>
    </div>
  `,
};
