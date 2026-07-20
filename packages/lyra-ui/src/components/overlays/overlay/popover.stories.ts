import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './popover.js';
import type { LyraPopover } from './popover.js';

const meta: Meta = { title: 'Overlay/Popover', component: 'lr-popover', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

// Forced open in the story canvas (but not in autodocs, viewMode === 'docs') so the visual-
// regression harness and anyone opening the story sees the actual popover surface rather than a
// bare closed trigger -- the same `.open` pattern lr-dialog and lr-drawer use.
export const Default: Story = {
  render: (_args, context) =>
    html`<lr-popover .open=${context.viewMode !== 'docs'}
      ><button slot="trigger">Open details</button><p>Floating content.</p></lr-popover
    >`,
};

function onSurfaceClick(e: MouseEvent): void {
  const surface = e.currentTarget as HTMLElement;
  const popover = surface.parentElement!.querySelector('lr-popover') as LyraPopover;
  // showAt() anchors to an arbitrary point instead of a slotted trigger -- exactly the contract a
  // canvas/SVG surface like lr-graph composes with (see llms-full.txt for a node-click example).
  popover.showAt({ x: e.clientX, y: e.clientY });
}

export const VirtualAnchor: Story = {
  name: 'showAt() — anchored to a click point (virtual anchor, no slotted trigger)',
  parameters: {
    docs: {
      description: {
        story:
          'Instead of a slotted `trigger`, `showAt({ x, y })` anchors the popover to an arbitrary rectangle -- here, the point clicked inside the surface below. Escape or an outside click still dismisses it, same as a trigger-based popover.',
      },
    },
  },
  render: () => html`
    <div>
      <div
        @click=${onSurfaceClick}
        style="width:20rem;height:10rem;border:1px dashed var(--lr-color-border);display:flex;align-items:center;justify-content:center;cursor:crosshair;"
      >
        Click anywhere — the popover anchors to that point
      </div>
      <lr-popover><p>Anchored to your click.</p></lr-popover>
    </div>
  `,
};
