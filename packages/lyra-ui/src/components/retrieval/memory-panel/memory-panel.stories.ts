import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './memory-panel.js';
import type { LyraMemoryItem } from './memory-panel.class.js';

const meta: Meta = {
  title: 'MemoryPanel',
  component: 'lr-memory-panel',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An agent\'s working memory surface. Each list omits blank and later duplicate memory ids first-wins before counts, state, rendering, confirmations, and actions; action details use memory or memoryId instead of generic item/id fields.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const shortTerm: LyraMemoryItem[] = [
  { id: 's1', text: 'The user is debugging a failing TypeScript build.', confidence: 0.9 },
  { id: 's2', text: 'The user prefers concise, code-first answers.' },
];

const longTerm: LyraMemoryItem[] = [
  {
    id: 'l1',
    text: "The user's name is Alex and they work at Acme Corp.",
    confidence: 0.4,
    provenance: {
      entities: [{ id: 'e1', label: 'Alex', type: 'person' }],
      chunks: [
        {
          id: 'ch1',
          text: 'Hi, I\'m Alex from Acme Corp -- excited to get started.',
          score: 0.6,
          sourceId: 'onboarding-chat',
          title: 'Onboarding conversation',
        },
      ],
    },
  },
  { id: 'l2', text: 'The user is allergic to peanuts.', confidence: 0.85 },
];

export const Default: Story = {
  render: () => html`<lr-memory-panel .shortTerm=${shortTerm} .longTerm=${longTerm}></lr-memory-panel>`,
};

export const Empty: Story = {
  render: () => html`<lr-memory-panel></lr-memory-panel>`,
};

export const ShortTermOnly: Story = {
  render: () => html`<lr-memory-panel .shortTerm=${shortTerm}></lr-memory-panel>`,
};

export const WithTypeLabels: Story = {
  render: () => html`
    <lr-memory-panel .shortTerm=${shortTerm} .longTerm=${longTerm} .types=${[{ id: 'person', label: 'Person' }]}></lr-memory-panel>
  `,
};

/**
 * Tab to any "Remove" / "Add to long-term memory" / "Forget all" control and press Enter: focus
 * moves into the confirmation that replaces it, landing on Deny — the safe action — instead of
 * being dropped back onto the page body. Escape cancels, exactly like pressing Deny, and returns
 * focus to the control the confirmation replaced: the row's own action for a per-item
 * confirmation, and `[part="forget-all-button"]` for the bulk one.
 */
export const KeyboardConfirmation: Story = {
  render: () => html`<lr-memory-panel .shortTerm=${shortTerm} .longTerm=${longTerm}></lr-memory-panel>`,
};

export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-memory-panel .shortTerm=${shortTerm} .longTerm=${longTerm}></lr-memory-panel>
    </div>
  `,
};
