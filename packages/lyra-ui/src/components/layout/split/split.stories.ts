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

export const ResponsiveOrientation: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)">
        Drag this box's bottom-right corner to shrink it below 500px — the
        split stacks its panels (<code>orientation-breakpoint="500"
        narrow-orientation="vertical"</code>) even though the surrounding
        page is wide. The observation boundary is the split's own measured
        allocation, not the viewport. Add
        <code>orientation-breakpoint-basis="viewport"</code> to key off the viewport via
        <code>matchMedia</code> instead of the split's own width — the only way two siblings in
        one row can flip together at a shared breakpoint.
      </p>
      <lr-split
        orientation-breakpoint="500"
        narrow-orientation="vertical"
        style="height: 12rem; border: 1px solid var(--lr-color-border)"
        @lr-split-orientation-change=${(e: CustomEvent<{ orientation: string }>) =>
          console.log('lr-split-orientation-change', e.detail.orientation)}
      >
        <div style="padding: 0.5rem">Panel A</div>
        <div style="padding: 0.5rem">Panel B</div>
      </lr-split>
    </div>

    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem; margin-block-start: 1rem;"
    >
      <p style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)">
        The same breakpoint authored as a CSS length
        (<code>orientation-breakpoint="31.25rem"</code>) — identical crossing
        width at the default 16px root font size, but it now tracks the root
        font size the way a sibling
        <code>@media (max-width: 31.25rem)</code> rule does. Try it: run
        <code>document.documentElement.style.fontSize = '32px'</code> in the
        console and this split stacks at twice the width, while the
        <code>500</code> one above doesn't move. <code>px</code>/<code>em</code>
        are accepted too; an unparseable or viewport-relative value
        (<code>80vw</code>) behaves as unset.
      </p>
      <lr-split
        orientation-breakpoint="31.25rem"
        narrow-orientation="vertical"
        style="height: 12rem; border: 1px solid var(--lr-color-border)"
        @lr-split-orientation-change=${(e: CustomEvent<{ orientation: string }>) =>
          console.log('lr-split-orientation-change (rem)', e.detail.orientation)}
      >
        <div style="padding: 0.5rem">Panel A</div>
        <div style="padding: 0.5rem">Panel B</div>
      </lr-split>
    </div>
  `,
};

export const PercentPanelConstraints: Story = {
  render: () => html`
    <lr-split
      style="height: 8rem; border: 1px solid var(--lr-color-border)"
      .panelConstraints=${[{ minPx: 200, minPercent: 20, maxPercent: 50 }, null]}
    >
      <div style="padding: 0.5rem">
        Sidebar — at least 200px AND at least 20% (whichever is stricter),
        at most 50%
      </div>
      <div style="padding: 0.5rem">Main content — fills the rest</div>
    </lr-split>
  `,
};
