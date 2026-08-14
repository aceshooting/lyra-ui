import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tooltip.js';
import '../../forms/icon-button/icon-button.js';
import type { LyraTooltip } from './tooltip.js';

const meta: Meta = { title: 'Overlay/Tooltip', component: 'lr-tooltip', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: (_args, context) =>
    html`<lr-tooltip .open=${context.viewMode !== 'docs'} manual show-delay="0"
      >Helpful context<button slot="trigger">Hover or focus</button></lr-tooltip
    >`,
};

/** The hidden light-DOM description proxy lets the icon button's focused native control resolve
 *  the tooltip text through `ariaDescribedByElements`, despite both components having shadows. */
export const LyraIconButtonTrigger: Story = {
  render: () => html`
    <lr-tooltip show-delay="0">
      Explain this action
      <lr-icon-button slot="trigger" icon="help" aria-label="Help"></lr-icon-button>
    </lr-tooltip>
  `,
};

export const ExternalOwner: Story = {
  name: 'Interaction ownership and external positioning',
  parameters: {
    docs: {
      description: {
        story:
          'A slotted trigger wins interaction and `aria-describedby` ownership. With no slotted trigger, a live HTML `for` target owns both, as shown here. Direct `.anchor` is positioning-only, while `showAt()` has no DOM interaction/ARIA owner.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <button id="tooltip-external-owner">Hover or focus this external owner</button>
      <lr-tooltip for="tooltip-external-owner" show-delay="0">
        The <code>for</code> target owns interaction and the description because no trigger is slotted.
      </lr-tooltip>
    </div>
  `,
};

export const ShoelaceSlotShape: Story = {
  name: 'Default trigger + content slot',
  parameters: {
    docs: {
      description: {
        story:
          'Shoelace markup puts the trigger in the default slot and tooltip content in `slot="content"`. A named `trigger` instead selects the Web Awesome/default-content shape.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-tooltip .open=${context.viewMode !== 'docs'} manual>
      <button type="button">Default-slot trigger</button>
      <span slot="content">Named tooltip content</span>
    </lr-tooltip>
  `,
};

export const CompatibilityOptions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`without-arrow` suppresses the mapped default arrow, `hoist` switches absolute positioning to fixed, and `disabled` blocks interaction and programmatic opening.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 2rem;">
      <lr-tooltip without-arrow hoist show-delay="0">
        Fixed without an arrow
        <button slot="trigger">Hoisted</button>
      </lr-tooltip>
      <lr-tooltip disabled content="This cannot open"><button>Disabled</button></lr-tooltip>
    </div>
  `,
};

export const ActionableContent: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Actionable default-slot content (including controls inside nested open shadow roots) promotes the popup from `role="tooltip"` to a named `role="dialog"` and keeps it open while pointer or focus is inside. Escape from popup content closes it and restores trigger focus. Use `<lr-popover>` instead when the trigger should own conventional click-to-open behavior.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-tooltip .open=${context.viewMode !== 'docs'} manual show-delay="0" aria-label="Helpful actions">
      <button slot="trigger">Hover or focus</button>
      <a href="#tooltip-action-target">Learn more</a>
    </lr-tooltip>
    <span id="tooltip-action-target"></span>
  `,
};

function onSurfaceClick(e: MouseEvent): void {
  const surface = e.currentTarget as HTMLElement;
  const tooltip = surface.parentElement!.querySelector('lr-tooltip') as LyraTooltip;
  // showAt() anchors to an arbitrary point with no DOM interaction owner -- exactly the contract a
  // canvas/SVG surface like lr-graph composes with for hover detail (see llms-full.txt).
  tooltip.showAt({ x: e.clientX, y: e.clientY });
}

export const VirtualAnchor: Story = {
  name: 'showAt() — anchored to a click point (virtual anchor, no slotted trigger)',
  parameters: {
    docs: {
      description: {
        story:
          'Instead of a DOM anchor, `showAt({ x, y })` anchors the tooltip to an arbitrary rectangle -- here, the point clicked inside the surface below. The virtual anchor wins positioning and has no DOM interaction/ARIA owner. There is no hover/blur to close it, so it stays open until Escape or an explicit `open = false`; another click reanchors it and keeps it open.',
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

export const ClickTrigger: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`trigger` takes a space-separated list of `hover`, `focus`, `click` and `manual`, defaulting to `"hover focus"`. `show-delay` and `hide-delay` are independent, so a tooltip can appear instantly and linger on the way out.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 2rem;">
      <lr-tooltip trigger="click" show-delay="0" arrow>
        Click again to dismiss.
        <button slot="trigger">Click me</button>
      </lr-tooltip>
      <lr-tooltip trigger="hover focus" show-delay="0" hide-delay="600" arrow arrow-placement="center">
        Lingers for 600ms after you leave.
        <button slot="trigger">Hover me</button>
      </lr-tooltip>
    </div>
  `,
};

export const ManualLifecycle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`trigger="manual"` leaves the tooltip entirely to `show()`/`hide()`, which bypass both delays. `lr-show`/`lr-hide` are cancelable; `lr-after-show`/`lr-after-hide` fire once the transition has finished.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <button
        @click=${(e: Event) =>
          ((e.currentTarget as HTMLElement).parentElement!.querySelector('lr-tooltip') as LyraTooltip).show()}
      >
        show()
      </button>
      <button
        @click=${(e: Event) =>
          ((e.currentTarget as HTMLElement).parentElement!.querySelector('lr-tooltip') as LyraTooltip).hide()}
      >
        hide()
      </button>
      <lr-tooltip trigger="manual" arrow>
        Driven only from script.
        <span slot="trigger">Anchor</span>
      </lr-tooltip>
    </div>
  `,
};
