import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chip.js';
import './chip-group.js';
import type { ChipSelectDetail } from './chip.js';

const meta: Meta = {
  title: 'Chip',
  component: 'lr-chip',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small, content-agnostic pill for a short label — a tag, an active-filter/scope indicator, etc. Distinct from `<lr-attachment-chip>` (specifically file-shaped). Controlled: the `removable` (×) button only fires `lr-remove` — the chip never removes itself.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Tones: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lr-chip tone="neutral">Neutral</lr-chip>
      <lr-chip tone="brand">Brand</lr-chip>
      <lr-chip tone="success">Success</lr-chip>
      <lr-chip tone="warning">Warning</lr-chip>
      <lr-chip tone="danger">Danger</lr-chip>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      ${(['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-chip size=${size} toggleable><span slot="icon">●</span>${size}</lr-chip>`,
      )}
    </div>
  `,
};

export const Removable: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lr-chip tone="neutral" removable>engineering</lr-chip>
      <lr-chip tone="brand" removable>customer-facing</lr-chip>
      <lr-chip tone="danger" removable>overdue</lr-chip>
    </div>
  `,
};

export const WithIcon: Story = {
  name: 'With a leading icon/dot',
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lr-chip tone="success">
        <span slot="icon" style="display:inline-block; inline-size:0.5em; block-size:0.5em; border-radius:50%; background:currentColor;"></span>
        Online
      </lr-chip>
      <lr-chip tone="warning" removable>
        <span slot="icon" style="display:inline-block; inline-size:0.5em; block-size:0.5em; border-radius:50%; background:currentColor;"></span>
        Degraded
      </lr-chip>
      <lr-chip tone="neutral">
        <svg slot="icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        research
      </lr-chip>
    </div>
  `,
};

export const ActiveFilterScope: Story = {
  name: 'Active-filter/scope indicators',
  parameters: {
    docs: {
      description: {
        story:
          'A typical use: showing the currently-active filters above a results list, each removable independently. `value` carries an opaque id back through `lr-remove` so the consumer knows which filter to drop.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
      <span style="font-size:0.8125rem; color:var(--lr-color-text-quiet);">Filters:</span>
      <lr-chip tone="brand" removable value="status:open">status: open</lr-chip>
      <lr-chip tone="brand" removable value="assignee:me">assignee: me</lr-chip>
      <lr-chip tone="brand" removable value="priority:high">priority: high</lr-chip>
    </div>
  `,
};

export const LongLabelTruncates: Story = {
  name: 'Long label truncates inside a constrained width',
  render: () => html`
    <div style="max-width:10rem;">
      <lr-chip tone="neutral" removable>a-very-long-tag-name-that-does-not-fit</lr-chip>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lr-chip
        tone="danger"
        removable
        value="tag-9"
        @lr-remove=${(e: CustomEvent<{ value?: string }>) => {
          const out = document.getElementById('chip-log');
          if (out) out.textContent = `lr-remove: ${JSON.stringify(e.detail)}`;
        }}
        >flaky-test</lr-chip
      >
      <p id="chip-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

export const ToggleSelection: Story = {
  name: 'selected/toggleable -- opt-in toggle mode, both directions',
  parameters: {
    docs: {
      description: {
        story:
          'Setting `selected` opts `[part=base]` into toggle/pressed interactive semantics (role="button", tabindex, keyboard activation, a reflected aria-pressed) and clicking flips it, firing `lr-chip-select` -- that opt-in survives toggling `selected` back off, so a chip that starts selected (the chart-series toggle on the left) stays clickable after the first click turns it off. A chip that must be clickable from the outset while starting **unselected** (an inactive category filter, on the right) sets `toggleable` explicitly instead of relying on `selected` alone.',
      },
    },
  },
  render: () => {
    const log = (e: CustomEvent<ChipSelectDetail>) => {
      const out = document.getElementById('chip-toggle-log');
      if (out) out.textContent = `lr-chip-select: ${JSON.stringify(e.detail)}`;
    };
    return html`
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
        <lr-chip tone="brand" selected value="series-a" @lr-chip-select=${log}>Series A</lr-chip>
        <lr-chip tone="brand" toggleable value="category:beta" @lr-chip-select=${log}>Category: Beta</lr-chip>
      </div>
      <p id="chip-toggle-log" style="font-family: monospace; margin-top: 0.5rem;">
        No event fired yet. Click a chip, then click it again -- it stays clickable both ways.
      </p>
    `;
  },
};

export const CustomPressedBackground: Story = {
  name: 'Custom pressed background',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-chip-pressed-bg` changes only the selected state, leaving the resting `--lr-chip-bg` independent.',
      },
    },
  },
  render: () => html`
    <lr-chip
      toggleable
      selected
      style="--lr-chip-bg: var(--lr-color-surface); --lr-chip-pressed-bg: var(--lr-color-warning-quiet);"
    >
      Priority filter
    </lr-chip>
  `,
};

export const GroupBasic: Story = {
  name: 'lr-chip-group — basic wrap, no overflow limit',
  render: () => html`
    <div style="max-width:24rem;">
      <lr-chip-group>
        <lr-chip>solar</lr-chip>
        <lr-chip>battery</lr-chip>
        <lr-chip>inverter</lr-chip>
        <lr-chip>grid</lr-chip>
        <lr-chip>weather</lr-chip>
        <lr-chip>forecast</lr-chip>
      </lr-chip-group>
    </div>
  `,
};

export const GroupWithOverflow: Story = {
  name: 'lr-chip-group — max-visible with a "+N" overflow toggle',
  parameters: {
    docs: {
      description: {
        story:
          'With `max-visible="4"` set and 7 chips slotted, the 5th onward collapse behind a "+3" indicator. Clicking it reveals the rest and relabels to "Show less"; clicking again re-collapses. `lr-overflow-toggle` fires on each click.',
      },
    },
  },
  render: () => html`
    <div style="max-width:22rem;">
      <lr-chip-group max-visible="4">
        <lr-chip removable value="solar">solar</lr-chip>
        <lr-chip removable value="battery">battery</lr-chip>
        <lr-chip removable value="inverter">inverter</lr-chip>
        <lr-chip removable value="grid">grid</lr-chip>
        <lr-chip removable value="weather">weather</lr-chip>
        <lr-chip removable value="forecast">forecast</lr-chip>
        <lr-chip removable value="maintenance">maintenance</lr-chip>
      </lr-chip-group>
    </div>
  `,
};

export const GroupEvents: Story = {
  name: 'lr-chip-group — lr-overflow-toggle',
  render: () => html`
    <div style="max-width:16rem;">
      <lr-chip-group
        max-visible="2"
        @lr-overflow-toggle=${(e: CustomEvent<{ expanded: boolean }>) => {
          const out = document.getElementById('chip-group-log');
          if (out) out.textContent = `lr-overflow-toggle: ${JSON.stringify(e.detail)}`;
        }}
      >
        <lr-chip>alpha</lr-chip>
        <lr-chip>beta</lr-chip>
        <lr-chip>gamma</lr-chip>
        <lr-chip>delta</lr-chip>
      </lr-chip-group>
      <p id="chip-group-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

export const ExactHeight: Story = {
  name: 'Per-tier min-height and exact-height hatch',
  parameters: {
    docs: {
      description: {
        story:
          'Interactive chips floor their tap target with `--lr-chip-min-height` (per tier: `2xs`–`m` share the 24px WCAG minimum, `l`/`xl` raise it). `--lr-chip-height` pins an exact height — below the 24px target it is for non-interactive display chips only.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
      <lr-chip toggleable style="--lr-chip-min-height: 40px;">Tall target</lr-chip>
      <lr-chip toggleable style="--lr-chip-height: 32px;">Pinned 32px</lr-chip>
      <lr-chip style="--lr-chip-height: 18px;">Compact display</lr-chip>
    </div>
  `,
};
