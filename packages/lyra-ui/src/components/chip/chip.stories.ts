import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chip.js';
import './chip-group.js';

const meta: Meta = {
  title: 'Chip',
  component: 'lyra-chip',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small, content-agnostic pill for a short label — a tag, an active-filter/scope indicator, etc. Distinct from `<lyra-attachment-chip>` (specifically file-shaped). Controlled: the `removable` (×) button only fires `lyra-remove` — the chip never removes itself.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Tones: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lyra-chip tone="neutral">Neutral</lyra-chip>
      <lyra-chip tone="brand">Brand</lyra-chip>
      <lyra-chip tone="success">Success</lyra-chip>
      <lyra-chip tone="warning">Warning</lyra-chip>
      <lyra-chip tone="danger">Danger</lyra-chip>
    </div>
  `,
};

export const Removable: Story = {
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lyra-chip tone="neutral" removable>engineering</lyra-chip>
      <lyra-chip tone="brand" removable>customer-facing</lyra-chip>
      <lyra-chip tone="danger" removable>overdue</lyra-chip>
    </div>
  `,
};

export const WithIcon: Story = {
  name: 'With a leading icon/dot',
  render: () => html`
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <lyra-chip tone="success">
        <span slot="icon" style="display:inline-block; inline-size:0.5em; block-size:0.5em; border-radius:50%; background:currentColor;"></span>
        Online
      </lyra-chip>
      <lyra-chip tone="warning" removable>
        <span slot="icon" style="display:inline-block; inline-size:0.5em; block-size:0.5em; border-radius:50%; background:currentColor;"></span>
        Degraded
      </lyra-chip>
      <lyra-chip tone="neutral">
        <svg slot="icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        research
      </lyra-chip>
    </div>
  `,
};

export const ActiveFilterScope: Story = {
  name: 'Active-filter/scope indicators',
  parameters: {
    docs: {
      description: {
        story:
          'A typical use: showing the currently-active filters above a results list, each removable independently. `value` carries an opaque id back through `lyra-remove` so the consumer knows which filter to drop.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
      <span style="font-size:0.8125rem; color:var(--lyra-color-text-quiet);">Filters:</span>
      <lyra-chip tone="brand" removable value="status:open">status: open</lyra-chip>
      <lyra-chip tone="brand" removable value="assignee:me">assignee: me</lyra-chip>
      <lyra-chip tone="brand" removable value="priority:high">priority: high</lyra-chip>
    </div>
  `,
};

export const LongLabelTruncates: Story = {
  name: 'Long label truncates inside a constrained width',
  render: () => html`
    <div style="max-width:10rem;">
      <lyra-chip tone="neutral" removable>a-very-long-tag-name-that-does-not-fit</lyra-chip>
    </div>
  `,
};

export const Events: Story = {
  render: () => html`
    <div>
      <lyra-chip
        tone="danger"
        removable
        value="tag-9"
        @lyra-remove=${(e: CustomEvent<{ value?: string }>) => {
          const out = document.getElementById('chip-log');
          if (out) out.textContent = `lyra-remove: ${JSON.stringify(e.detail)}`;
        }}
        >flaky-test</lyra-chip
      >
      <p id="chip-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};

export const GroupBasic: Story = {
  name: 'lyra-chip-group — basic wrap, no overflow limit',
  render: () => html`
    <div style="max-width:24rem;">
      <lyra-chip-group>
        <lyra-chip>solar</lyra-chip>
        <lyra-chip>battery</lyra-chip>
        <lyra-chip>inverter</lyra-chip>
        <lyra-chip>grid</lyra-chip>
        <lyra-chip>weather</lyra-chip>
        <lyra-chip>forecast</lyra-chip>
      </lyra-chip-group>
    </div>
  `,
};

export const GroupWithOverflow: Story = {
  name: 'lyra-chip-group — max-visible with a "+N" overflow toggle',
  parameters: {
    docs: {
      description: {
        story:
          'With `max-visible="4"` set and 7 chips slotted, the 5th onward collapse behind a "+3" indicator. Clicking it reveals the rest and relabels to "Show less"; clicking again re-collapses. `lyra-overflow-toggle` fires on each click.',
      },
    },
  },
  render: () => html`
    <div style="max-width:22rem;">
      <lyra-chip-group max-visible="4">
        <lyra-chip removable value="solar">solar</lyra-chip>
        <lyra-chip removable value="battery">battery</lyra-chip>
        <lyra-chip removable value="inverter">inverter</lyra-chip>
        <lyra-chip removable value="grid">grid</lyra-chip>
        <lyra-chip removable value="weather">weather</lyra-chip>
        <lyra-chip removable value="forecast">forecast</lyra-chip>
        <lyra-chip removable value="maintenance">maintenance</lyra-chip>
      </lyra-chip-group>
    </div>
  `,
};

export const GroupEvents: Story = {
  name: 'lyra-chip-group — lyra-overflow-toggle',
  render: () => html`
    <div style="max-width:16rem;">
      <lyra-chip-group
        max-visible="2"
        @lyra-overflow-toggle=${(e: CustomEvent<{ expanded: boolean }>) => {
          const out = document.getElementById('chip-group-log');
          if (out) out.textContent = `lyra-overflow-toggle: ${JSON.stringify(e.detail)}`;
        }}
      >
        <lyra-chip>alpha</lyra-chip>
        <lyra-chip>beta</lyra-chip>
        <lyra-chip>gamma</lyra-chip>
        <lyra-chip>delta</lyra-chip>
      </lyra-chip-group>
      <p id="chip-group-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </div>
  `,
};
