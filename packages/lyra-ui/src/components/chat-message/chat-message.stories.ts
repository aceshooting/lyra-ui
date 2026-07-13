import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chat-message.js';

const meta: Meta = {
  title: 'ChatMessage',
  component: 'lyra-chat-message',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A role-based message bubble shell for a chat/agent conversation surface. It renders no content of its own — the default slot carries plain text, a `<lyra-markdown>`, or anything else a consumer wants — and only supplies chrome: alignment/coloring by `role`, an avatar/badges header, an optional collapse toggle, an attachments strip, and a status-aware footer.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-chat-message data-role="assistant" .timestamp=${new Date()} style="max-width: 32rem; display: block;">
      Here's a summary of the last deploy: three services restarted cleanly and error rates are back to baseline.
    </lyra-chat-message>
  `,
};

export const Roles: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 32rem;">
      <lyra-chat-message data-role="system" .timestamp=${new Date()}>Conversation started.</lyra-chat-message>
      <lyra-chat-message data-role="user" .timestamp=${new Date()}>
        Can you check why the nightly build failed?
      </lyra-chat-message>
      <lyra-chat-message data-role="assistant" .timestamp=${new Date()}>
        The build failed because the "lint" step hit a type error in chart.ts — looks like an unrelated rename
        left a stale import behind.
      </lyra-chat-message>
    </div>
  `,
};

export const Statuses: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 32rem;">
      <lyra-chat-message data-role="user" status="sending">Deploying the hotfix now…</lyra-chat-message>
      <lyra-chat-message data-role="assistant" status="streaming">Looking at the last three commits</lyra-chat-message>
      <lyra-chat-message
        data-role="assistant"
        status="failed"
        @lyra-retry=${() => alert('lyra-retry fired — re-run whatever produced this message.')}
      >
        I couldn't reach the deploy service.
      </lyra-chat-message>
      <lyra-chat-message data-role="assistant" status="sent" .timestamp=${new Date()}>
        Done — the fix is live.
      </lyra-chat-message>
    </div>
  `,
};

export const WithAvatarBadgesAndActions: Story = {
  render: () => html`
    <lyra-chat-message data-role="assistant" .timestamp=${new Date()} style="max-width: 32rem; display: block;">
      <span
        slot="avatar"
        style="display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:50%;background:var(--lyra-color-brand);color:var(--lyra-color-on-brand);font-size:0.75rem;"
        >AI</span
      >
      <span
        slot="badges"
        style="font-size:0.6875rem;padding:0.0625rem 0.375rem;border-radius:999px;background:var(--lyra-color-brand-quiet);color:var(--lyra-color-brand);"
        >gpt-5.4</span
      >
      <span
        slot="badges"
        style="font-size:0.6875rem;padding:0.0625rem 0.375rem;border-radius:999px;background:var(--lyra-color-surface);color:var(--lyra-color-text-quiet);"
        >812 tokens · 1.4s</span
      >
      Migrating the table component to the new pagination API touches four files; want me to open a PR?
      <span slot="attachments">
        <span
          style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.75rem;padding:0.25rem 0.5rem;border:1px solid var(--lyra-color-border);border-radius:0.375rem;"
          >📎 table.diff</span
        >
      </span>
      <button
        slot="actions"
        style="font:inherit;font-size:0.75rem;background:none;border:none;color:inherit;cursor:pointer;padding:0;"
        @click=${(e: Event) =>
          e.currentTarget!.dispatchEvent(
            new CustomEvent('lyra-copy', { bubbles: true, composed: true, detail: { text: 'copied!' } }),
          )}
      >
        Copy
      </button>
    </lyra-chat-message>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lyra-chat-message
      data-role="assistant"
      collapsible
      collapsed
      .timestamp=${new Date()}
      style="max-width: 32rem; display: block;"
      @lyra-collapse-toggle=${(e: CustomEvent<boolean>) => console.log('collapsed:', e.detail)}
    >
      This is a long tool-output-style message that starts collapsed — click the chevron to reveal it. Lorem ipsum
      dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna
      aliqua.
    </lyra-chat-message>
  `,
};

export const CustomTimestampFormat: Story = {
  render: () => html`
    <lyra-chat-message
      data-role="user"
      .timestamp=${new Date()}
      .formatTimestamp=${(date: Date) => `${date.toLocaleDateString()} · ${date.toLocaleTimeString()}`}
      style="max-width: 32rem; display: block;"
    >
      Overriding the default hour:minute rendering with a full date + time via formatTimestamp.
    </lyra-chat-message>
  `,
};
