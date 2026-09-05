import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './popover.js';
import '../../forms/button/button.js';
import type { LyraPopover } from './popover.js';

const meta: Meta = {
  parameters: { docs: { description: { component: 'Open popovers, dropdowns and tooltips reposition when their effective host or inherited text direction changes, preserving open state and lifecycle events.' } } }, title: 'Overlay/Popover', component: 'lr-popover', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

// Forced open in the story canvas (but not in autodocs, viewMode === 'docs') so the visual-
// regression harness and anyone opening the story sees the actual popover surface rather than a
// bare closed trigger -- the same `.open` pattern lr-dialog and lr-drawer use.
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The mapped defaults are `placement="top"`, `distance="8"`, with the arrow visible.',
      },
    },
  },
  render: (_args, context) =>
    html`<lr-popover .open=${context.viewMode !== 'docs'}
      ><button slot="trigger">Open details</button><p>Floating content.</p></lr-popover
    >`,
};

export const WithoutArrow: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`without-arrow` suppresses the mapped default arrow. `arrow="false"` is also parsed correctly by the true-default boolean converter.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-popover .open=${context.viewMode !== 'docs'} without-arrow>
      <button slot="trigger">Open plain surface</button>
      <p>No arrow is rendered.</p>
    </lr-popover>
  `,
};

/** `aria-label` names the semantic popup inside the shadow tree. An explicitly empty attribute
 * intentionally suppresses the localized fallback when a consuming application needs it unnamed. */
export const AccessibleName: Story = {
  render: (_args, context) => html`
    <lr-popover aria-label="Additional account information" .open=${context.viewMode !== 'docs'}>
      <button slot="trigger">Open account details</button>
      <p>Account details available to assistive technology under the supplied popup name.</p>
    </lr-popover>
  `,
};

/** Lyra buttons preserve the trigger relationship across their own shadow boundary: the
 *  popover points `aria-controls` at its public host and the focused native button receives that
 *  target through `ariaControlsElements` in supporting browsers. */
export const LyraButtonTrigger: Story = {
  render: () => html`
    <lr-popover>
      <lr-button slot="trigger">Open details</lr-button>
      <p>Floating content controlled by the Lyra button.</p>
    </lr-popover>
  `,
};

function onSurfaceClick(e: MouseEvent): void {
  const surface = e.currentTarget as HTMLElement;
  const popover = surface.parentElement!.querySelector('lr-popover') as LyraPopover;
  // showAt() anchors to an arbitrary point with no DOM interaction owner -- exactly the contract a
  // canvas/SVG surface like lr-graph composes with (see llms-full.txt for a node-click example).
  popover.showAt({ x: e.clientX, y: e.clientY });
}

export const VirtualAnchor: Story = {
  name: 'showAt() — anchored to a click point (virtual anchor, no slotted trigger)',
  parameters: {
    docs: {
      description: {
        story:
          'Instead of a DOM anchor, `showAt({ x, y })` anchors the popover to an arbitrary rectangle -- here, the point clicked inside the surface below. The virtual anchor wins positioning and has no DOM interaction/ARIA owner. Escape or an outside click still dismisses it.',
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

export const Arrow: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`arrow` renders a pointer at the popup edge. `arrow-placement` chooses between tracking the anchor (`anchor`, the default), the middle of the edge (`center`), or one logical end of it (`start`/`end`, kept `arrow-padding` from the corner). The arrow part name also carries the resolved side, so `::part(arrow arrow-top)` styles one direction.',
      },
    },
  },
  render: (_args, context) => html`
    <div style="display: flex; gap: 4rem; padding-block: 3rem;">
      <lr-popover .open=${context.viewMode !== 'docs'} arrow placement="bottom">
        <button slot="trigger">Anchor arrow</button>
        <p>Points back at the trigger's centre.</p>
      </lr-popover>
      <lr-popover .open=${context.viewMode !== 'docs'} arrow arrow-placement="start" arrow-padding="12" placement="bottom-start">
        <button slot="trigger">Start arrow</button>
        <p>Pinned 12px from the popup's logical start corner.</p>
      </lr-popover>
    </div>
  `,
};

export const ExternalAnchor: Story = {
  name: 'Interaction ownership and external positioning',
  parameters: {
    docs: {
      description: {
        story:
          'A slotted trigger wins click and ARIA ownership. With no slotted trigger, a live HTML `for` target owns both; the first example demonstrates that shape. In the second, `for` changes positioning while the slotted trigger remains the owner. Direct `.anchor` is positioning-only, and `showAt()` has no DOM owner. `skidding` slides the popup along the anchor edge.',
      },
    },
  },
  render: (_args, context) => html`
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      <button id="popover-external-owner">This external button opens and owns the popover</button>
      <lr-popover for="popover-external-owner">
        <p>The live HTML <code>for</code> target owns click and generated ARIA because no trigger is slotted.</p>
      </lr-popover>
      <div id="popover-external-anchor" style="padding: 0.5rem; border: 1px dashed var(--lr-color-border);">
        The popup is positioned against this box
      </div>
      <lr-popover .open=${context.viewMode !== 'docs'} for="popover-external-anchor" skidding="16" arrow>
        <button slot="trigger">Trigger lives down here</button>
        <p>Anchored elsewhere, triggered here.</p>
      </lr-popover>
    </div>
  `,
};

export const DisclosureNavigation: Story = {
  name: 'Disclosure navigation (popup-role="none")',
  parameters: {
    docs: {
      description: {
        story:
          'A list of links is neither a `dialog` nor a `menu`. `popup-role="none"` renders no role and no generated `aria-label`, and leaves `aria-haspopup` off the trigger, so the slotted `<nav>` owns the semantics and a screen reader announces "navigation, link" rather than "menu, menu item". The `aria-expanded`/`aria-controls` wiring the WAI-ARIA disclosure-navigation pattern needs is unchanged, as are light dismiss, Escape, and focus return.',
      },
    },
  },
  render: (_args, context) => html`
    <lr-popover .open=${context.viewMode !== 'docs'} popup-role="none" placement="bottom-start">
      <button slot="trigger">Products</button>
      <nav aria-label="Products">
        <ul style="margin: 0; padding-inline-start: 1.25rem;">
          <li><a href="#overview">Overview</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#changelog">Changelog</a></li>
        </ul>
      </nav>
    </lr-popover>
  `,
};
