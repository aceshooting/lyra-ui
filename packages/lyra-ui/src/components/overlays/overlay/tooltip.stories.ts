import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tooltip.js';
import type { LyraTooltip } from './tooltip.js';

const meta: Meta = { title: 'Overlay/Tooltip', component: 'lr-tooltip', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: (_args, context) =>
    html`<lr-tooltip .open=${context.viewMode !== 'docs'} manual delay="0"
      >Helpful context<button slot="trigger">Hover or focus</button></lr-tooltip
    >`,
};

export const ActionableContent: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Actionable default-slot content promotes the popup from `role="tooltip"` to a named `role="dialog"` and keeps it open while pointer or focus is inside. Use `<lr-popover>` instead when the trigger should own conventional click-to-open behavior.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-tooltip .open=${context.viewMode !== 'docs'} manual delay="0" accessible-label="Helpful actions">
      <button slot="trigger">Hover or focus</button>
      <a href="#tooltip-action-target">Learn more</a>
    </lr-tooltip>
    <span id="tooltip-action-target"></span>
  `,
};

function onSurfaceClick(e: MouseEvent): void {
  const surface = e.currentTarget as HTMLElement;
  const tooltip = surface.parentElement!.querySelector('lr-tooltip') as LyraTooltip;
  // showAt() anchors to an arbitrary point instead of a slotted trigger -- exactly the contract a
  // canvas/SVG surface like lr-graph composes with for hover detail (see llms-full.txt).
  tooltip.showAt({ x: e.clientX, y: e.clientY });
}

export const VirtualAnchor: Story = {
  name: 'showAt() — anchored to a click point (virtual anchor, no slotted trigger)',
  parameters: {
    docs: {
      description: {
        story:
          'Instead of a slotted `trigger`, `showAt({ x, y })` anchors the tooltip to an arbitrary rectangle -- here, the point clicked inside the surface below. There is no hover/blur to close it since there is no real trigger, so it stays open until Escape or the next click.',
      },
    },
  },
  render: () => html`
    <div>
      <div
        @click=${onSurfaceClick}
        style="width:20rem;height:10rem;border:1px dashed var(--lr-color-border);display:flex;align-items:center;justify-content:center;cursor:crosshair;"
      >
        Click anywhere — the tooltip anchors to that point
      </div>
      <lr-tooltip>Anchored to your click.</lr-tooltip>
    </div>
  `,
};
