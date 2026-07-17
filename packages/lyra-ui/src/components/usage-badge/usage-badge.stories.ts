import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './usage-badge.js';
import '../chat-message/chat-message.js';
import '../markdown/markdown.js';

const meta: Meta = {
  title: 'UsageBadge',
  component: 'lyra-usage-badge',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact, static resource strip for one message or run — tokens in/out, cost, latency — with a hover/focus tooltip breakdown.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () =>
    html`<lyra-usage-badge tokens-in="1204" tokens-out="386" cost-text="$0.012" latency-ms="2350"></lyra-usage-badge>`,
};

export const Compact: Story = {
  render: () =>
    html`<lyra-usage-badge compact tokens-in="12345" tokens-out="4210" cost-text="$0.31" latency-ms="61500"></lyra-usage-badge>`,
};

export const CostOnly: Story = {
  render: () => html`<lyra-usage-badge cost-text="$0.004"></lyra-usage-badge>`,
};

export const WithExtraSlottedRow: Story = {
  render: () => html`
    <lyra-usage-badge tokens-in="1204" tokens-out="386">
      <div>Cache-read tokens: 900</div>
    </lyra-usage-badge>
  `,
};

export const InChatMessage: Story = {
  name: 'Composed in a lyra-chat-message',
  render: () => html`
    <lyra-chat-message data-role="assistant" status="sent" style="max-width: 32rem;">
      <lyra-usage-badge
        slot="badges"
        tokens-in="1204"
        tokens-out="386"
        cost-text="$0.012"
        latency-ms="2350"
      ></lyra-usage-badge>
      <lyra-markdown content="Here is the summary you asked for."></lyra-markdown>
    </lyra-chat-message>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lyra-usage-badge tokens-in="1204" tokens-out="386" cost-text="$0.012" latency-ms="2350"></lyra-usage-badge>
    </div>
  `,
};
