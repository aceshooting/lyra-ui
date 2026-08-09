import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import './popup.js';
import type { LyraPopup } from './popup.class.js';

const meta: Meta = { title: 'Overlays/Popup', component: 'lr-popup', tags: ['autodocs'] };
export default meta;

const panel = (text: string) => html`
  <div style="padding: 0.5rem 0.75rem; border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface-raised);">
    ${text}
  </div>
`;

export const Default: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'The positioned node is available through `.popup`. Upstream typings make that reference assignment-compatible, but the shadow-owned node remains authoritative so positioning, animations, and CSS parts stay connected.',
      },
    },
  },
  render: () => html`
    <div style="padding: 4rem;">
      <lr-popup active>
        <button slot="anchor">Anchor</button>
        ${panel('Mapped defaults: top, absolute, zero distance')}
      </lr-popup>
    </div>
  `,
};

export const RightToLeft: StoryObj = {
  name: 'RTL fixed-width geometry',
  parameters: {
    docs: {
      description: {
        story:
          'The physical coordinates produced by the shared positioner remain authoritative under RTL: a fixed-width popup stays fixed-width and centered against its anchor rather than stretching to the containing block\'s opposite edge.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" style="position: relative; inline-size: 32rem; block-size: 12rem;">
      <lr-popup active placement="bottom">
        <button slot="anchor" style="position: absolute; left: 5rem; top: 2rem; inline-size: 7rem;">
          مرساة
        </button>
        <div style="inline-size: 10rem;">${panel('نافذة ثابتة العرض')}</div>
      </lr-popup>
    </div>
  `,
};

export const WithArrow: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`arrow-placement` chooses between tracking the anchor (`anchor`, the default), the middle of the popup edge (`center`), or one logical end of it (`start`/`end`, kept `arrow-padding` from the corner) — the same vocabulary `<lr-popover>` and `<lr-tooltip>` use. The arrow part name also carries the resolved side, so `::part(arrow arrow-top)` styles one direction.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 6rem; padding: 4rem;">
      <lr-popup active arrow placement="top" distance="8">
        <button slot="anchor">Anchor</button>
        ${panel('Points at its anchor')}
      </lr-popup>
      <lr-popup active arrow arrow-placement="start" arrow-padding="16" placement="top" distance="8">
        <button slot="anchor">Start</button>
        ${panel('Arrow pinned to the start edge')}
      </lr-popup>
    </div>
  `,
};

export const SyncedToAnchor: StoryObj = {
  name: 'Sized to its anchor (sync)',
  parameters: {
    docs: {
      description: {
        story:
          '`sync="width"` copies the anchor\'s inline size onto the popup — the shape a listbox or autocomplete panel wants. `sync="height"` and `sync="both"` do the same for the block axis.',
      },
    },
  },
  render: () => html`
    <div style="padding: 4rem;">
      <lr-popup active sync="width" placement="bottom-start">
        <button slot="anchor" style="inline-size: 18rem;">A deliberately wide anchor</button>
        ${panel('Exactly as wide as the anchor')}
      </lr-popup>
    </div>
  `,
};

export const ConstrainedByBoundaries: StoryObj = {
  name: 'Flip, shift and auto-size boundaries',
  parameters: {
    docs: {
      description: {
        story:
          '`flip-boundary`, `shift-boundary` and `auto-size-boundary` swap the viewport for an element of your choosing, each with its own padding knob (`flip-padding`, `shift-padding`, `auto-size-padding`). Here the popup flips and shrinks to stay inside the dashed box rather than the page. `flip-fallback-placements` lists the placements `flip` tries in order, and `flip-fallback-strategy` decides what happens when none of them fit.',
      },
    },
  },
  render: () => html`
    <div
      id="popup-boundary"
      style="position: relative; block-size: 14rem; margin: 3rem; padding: 1rem; overflow: hidden; border: 1px dashed var(--lr-color-border);"
    >
      <lr-popup
        ${ref((el?: Element) => {
          // The boundary is the popup's own wrapper, which only exists once the story has
          // rendered — hence a ref rather than a property in the template.
          const popup = el as LyraPopup | undefined;
          const boundary = popup?.parentElement;
          if (!popup || !boundary) return;
          popup.flipBoundary = boundary;
          popup.shiftBoundary = boundary;
          popup.autoSizeBoundary = boundary;
        })}
        active
        placement="bottom-start"
        flip
        shift
        flip-fallback-placements="top-start right-start"
        auto-size="both"
        auto-size-padding="8"
      >
        <button slot="anchor" style="position: absolute; inset-block-end: 1rem; inset-inline-start: 1rem;">
          Anchor near the edge
        </button>
        ${panel('Kept inside the dashed boundary')}
      </lr-popup>
    </div>
  `,
};

export const HoverBridge: StoryObj = {
  name: 'Hover bridge across the gap',
  parameters: {
    docs: {
      description: {
        story:
          '`hover-bridge` renders an invisible quad spanning the `distance` gap between anchor and popup, so a pointer travelling between them never leaves both at once. `<lr-popup>` owns no hover policy itself — this is the geometry a hover-driven component built on top needs.',
      },
    },
  },
  render: () => html`
    <div style="padding: 4rem;">
      <lr-popup active hover-bridge distance="40" placement="bottom-start">
        <button slot="anchor">Anchor</button>
        ${panel('40px away, still one hover region')}
      </lr-popup>
    </div>
  `,
};

export const ExternalAnchor: StoryObj = {
  name: 'Anchored by id (for)',
  render: () => html`
    <div style="padding: 4rem;">
      <button id="popup-external-anchor">Elsewhere in the tree</button>
      <lr-popup active for="popup-external-anchor" placement="right">${panel('Anchored by id')}</lr-popup>
    </div>
  `,
};

export const DirectAnchor: StoryObj = {
  name: 'Direct element anchor',
  parameters: {
    docs: {
      description: {
        story:
          'The `anchor` property accepts an element directly (and also accepts a same-root id string or virtual element), taking priority over `for` and the slot.',
      },
    },
  },
  render: () => html`
    <div style="padding: 4rem;">
      <button id="popup-direct-anchor">Direct property anchor</button>
      <lr-popup
        ${ref((node?: Element) => {
          const popup = node as LyraPopup | undefined;
          const anchor = popup?.parentElement?.querySelector('#popup-direct-anchor');
          if (popup && anchor) popup.anchor = anchor;
        })}
        active
        placement="right"
      >
        ${panel('Anchored through `.anchor`')}
      </lr-popup>
    </div>
  `,
};

export const VirtualAnchorRect: StoryObj = {
  name: 'Virtual rectangle anchor',
  parameters: {
    docs: {
      description: {
        story:
          '`virtualAnchor` accepts a plain viewport rectangle for canvas, chart, selection, or other non-element targets. Omitted dimensions default to zero, negative dimensions clamp to zero, and a rect containing `NaN` or infinity is ignored rather than reaching layout. Every successful coordinate recomputation emits `lr-reposition`, even when the resolved side stays unchanged.',
      },
    },
  },
  render: () => html`
    <lr-popup
      ${ref((node?: Element) => {
        const popup = node as LyraPopup | undefined;
        if (popup) popup.virtualAnchor = { x: 240, y: 160, width: -20, height: -10 };
      })}
      active
      strategy="fixed"
      placement="bottom"
    >
      ${panel('Negative dimensions normalize to a point anchor')}
    </lr-popup>
  `,
};
