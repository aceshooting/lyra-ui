import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './toggle.js';
import '../icon-button/icon-button.js';
import '../../conversation/message-actions/message-actions.js';
import '../../utility/copy-button/copy-button.js';

const meta: Meta = {
  title: 'Forms & Inputs/Toggle',
  component: 'lr-toggle',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A two-state button that owns its `pressed` state. A user activation emits the cancelable `lr-toggle-toggle-request`, then `lr-change`; programmatic writes are silent. Keep the label constant while the state changes: `aria-pressed` alone conveys it.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const pinIcon = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 17v5"></path><path d="M9 3h6l-1 7 4 3v2H6v-2l4-3z"></path></svg>`;
const speakerIcon = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M16 9a4 4 0 0 1 0 6"></path></svg>`;

export const Default: Story = {
  render: () => html`<lr-toggle value="bold">Bold</lr-toggle>`,
};

export const Pressed: Story = {
  render: () => html`<lr-toggle pressed value="bold">Bold</lr-toggle>`,
};

export const Outlined: Story = {
  render: () => html`
    <div style="display:flex;gap:var(--lr-space-s);flex-wrap:wrap">
      <lr-toggle appearance="outlined" value="grid">Grid lines</lr-toggle>
      <lr-toggle appearance="outlined" pressed value="totals">Totals</lr-toggle>
    </div>
  `,
};

export const IconOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'An icon-only toggle needs a name from the host `aria-label`, `aria-labelledby`, or a labelled icon; there is no generic fallback. The name stays "Pin message" in both states: assistive technology announces the pressed state from `aria-pressed`, so swapping the label to "Unpin" would announce the change twice.',
      },
    },
  },
  render: () => html`
    <div style="display:flex;gap:var(--lr-space-s)">
      <lr-toggle aria-label="Pin message" value="pin">${pinIcon}</lr-toggle>
      <lr-toggle aria-label="Read aloud" pressed value="read">${speakerIcon}</lr-toggle>
    </div>
  `,
};

export const WithStartEnd: Story = {
  render: () => html`
    <lr-toggle value="mute">
      <span slot="start">${speakerIcon}</span>
      Mute notifications
      <span slot="end" style="font-size:var(--lr-font-size-xs)">⌘M</span>
    </lr-toggle>
  `,
};

export const Variants: Story = {
  parameters: {
    docs: {
      description: {
        story: '`variant` selects the semantic row for the pressed fill and its loud 3:1 border indicator.',
      },
    },
  },
  render: () => html`
    <div style="display:flex;gap:var(--lr-space-s);flex-wrap:wrap">
      ${(['neutral', 'brand', 'success', 'warning', 'danger'] as const).map(
        (variant) => html`<lr-toggle pressed variant=${variant} value=${variant}>${variant}</lr-toggle>`,
      )}
    </div>
  `,
};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The toggle follows the shared size ladder, including for icon-only content. Every tier keeps a 24px target on both axes and a coarse pointer floors every tier at 44px; only fine-pointer `2xs`, `xs` and `s` sit below the 40px compact floor, so keep `m` or larger where that floor matters.',
      },
    },
  },
  render: () => html`
    <div style="display:flex;gap:var(--lr-space-s);align-items:center;flex-wrap:wrap">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-toggle size=${size} value=${size}>${size}</lr-toggle>`,
      )}
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex;gap:var(--lr-space-s)">
      <lr-toggle disabled value="off">Disabled</lr-toggle>
      <lr-toggle disabled pressed value="on">Disabled, pressed</lr-toggle>
    </div>
  `,
};

export const InMessageActions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Standalone toggles contribute themselves to the toolbar through `getToolbarActions()`, so the pin and read-aloud toggles share the toolbar\'s single roving tab stop with the copy button.',
      },
    },
  },
  render: () => html`
    <lr-message-actions>
      <lr-copy-button value="The quarterly report is ready."></lr-copy-button>
      <lr-toggle aria-label="Pin message" value="pin">${pinIcon}</lr-toggle>
      <lr-toggle aria-label="Read aloud" value="read">${speakerIcon}</lr-toggle>
    </lr-message-actions>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" lang="ar" style="display:flex;gap:var(--lr-space-s)">
      <lr-toggle value="bold"><span slot="start">${speakerIcon}</span>كتم الصوت</lr-toggle>
      <lr-toggle pressed appearance="outlined" value="italic">مائل</lr-toggle>
    </div>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size:320px;border:1px dashed var(--lr-color-border);padding:var(--lr-space-s)">
      <lr-toggle value="long">
        <span slot="start">${speakerIcon}</span>
        Mute every notification from this very long conversation thread
      </lr-toggle>
    </div>
  `,
};
