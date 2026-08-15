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
          'A small, content-agnostic pill for a short label — a tag, an active-filter/scope indicator, etc. Distinct from `<lr-attachment-chip>` (specifically file-shaped). Controlled: the `removable` (×) button only fires `lr-remove` — the chip never removes itself. Unsupported `size`/`variant` values normalize to reflected `m`/`neutral`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Variants: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lr-chip variant="neutral">Neutral</lr-chip>
      <lr-chip variant="brand">Brand</lr-chip>
      <lr-chip variant="success">Success</lr-chip>
      <lr-chip variant="warning">Warning</lr-chip>
      <lr-chip variant="danger">Danger</lr-chip>
    </div>
  `,
};

export const Pill: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The chip is a rounded rectangle by default and only takes fully-rounded ends with `pill`, the same opt-in `<lr-badge>` and `<lr-tag>` use.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      <lr-chip variant="brand">Rounded rectangle</lr-chip>
      <lr-chip variant="brand" pill>Pill</lr-chip>
      <lr-chip variant="brand" pill removable>Pill, removable</lr-chip>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      ${(['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-chip size=${size} toggleable><span slot="start">●</span>${size}</lr-chip>`,
      )}
    </div>
  `,
};

export const Removable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A host `aria-label`, when present, names one aggregate group. The nested remove action keeps a purpose-specific “Remove {visible label}” name, including when the host label is explicitly empty.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lr-chip variant="neutral" removable>engineering</lr-chip>
      <lr-chip variant="brand" removable>customer-facing</lr-chip>
      <lr-chip variant="danger" removable>overdue</lr-chip>
    </div>
  `,
};

export const Disabled: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`disabled` reaches the active native control in both interaction modes, blocks focus and activation, and suppresses selection/removal requests.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lr-chip variant="brand" toggleable disabled>Disabled toggle</lr-chip>
      <lr-chip variant="danger" removable disabled>Disabled remove</lr-chip>
    </div>
  `,
};

export const WithStart: Story = {
  name: 'With decorative start content',
  parameters: {
    docs: {
      description: {
        story:
          'The start slot is always visible presentation content whose flattened subtree is inert and aria-hidden. The end slot remains ordinary consumer content in passive/removable mode and follows that presentation contract only beneath a full-surface toggle.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lr-chip variant="success">
        <span slot="start" style="display:inline-block; inline-size:0.5em; block-size:0.5em; border-radius:50%; background:currentColor;"></span>
        Online
      </lr-chip>
      <lr-chip variant="warning" removable>
        <span slot="start" style="display:inline-block; inline-size:0.5em; block-size:0.5em; border-radius:50%; background:currentColor;"></span>
        Degraded
      </lr-chip>
      <lr-chip variant="neutral">
        <svg slot="start" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        research
        <span slot="end">↗</span>
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
      <lr-chip variant="brand" removable value="status:open">status: open</lr-chip>
      <lr-chip variant="brand" removable value="assignee:me">assignee: me</lr-chip>
      <lr-chip variant="brand" removable value="priority:high">priority: high</lr-chip>
    </div>
  `,
};

export const LongLabelTruncates: Story = {
  name: 'Long label truncates inside a constrained width',
  render: () => html`
    <div style="max-width:10rem;">
      <lr-chip variant="neutral" removable>a-very-long-tag-name-that-does-not-fit</lr-chip>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lr-chip
        variant="danger"
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
          '`toggleable` is the sole opt-in for the native `[part=toggle-button]`; `selected` independently supplies its current `aria-pressed` state. The visible label, start, and end layers become inert and aria-hidden, so the toggle remains the sole action; do not put independent controls in those slots. Activation emits the cancelable `lr-chip-select` event with the proposed next state before mutation; call `preventDefault()` to keep the current selection.',
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
        <lr-chip variant="brand" toggleable selected value="series-a" @lr-chip-select=${log}>Series A</lr-chip>
        <lr-chip variant="brand" toggleable value="category:beta" @lr-chip-select=${log}>Category: Beta</lr-chip>
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
          'Interactive chips floor their tap target with the shared `--lr-icon-button-size` (40px by default), while `--lr-chip-min-height` can make the visible pill taller. `--lr-chip-height` pins an exact visual height; values below the shared target are for non-interactive display chips only.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
      <lr-chip toggleable style="--lr-chip-min-height: 40px;">Tall target</lr-chip>
      <lr-chip toggleable style="--lr-chip-height: var(--lr-icon-button-size);">Pinned to the shared target</lr-chip>
      <lr-chip style="--lr-chip-height: 18px;">Compact display</lr-chip>
    </div>
  `,
};
