import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chat-message.js';

const meta: Meta = {
  title: 'ChatMessage',
  component: 'lr-chat-message',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A role-based message bubble shell for a chat/agent conversation surface. It renders no content of its own — the default slot carries plain text, a `<lr-markdown>`, or anything else a consumer wants — and only supplies chrome: alignment/coloring by `role`, an avatar/badges header, an optional collapse toggle, an attachments strip, and a status-aware footer.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-chat-message data-role="assistant" .timestamp=${new Date()} style="max-width: 32rem; display: block;">
      Here's a summary of the last deploy: three services restarted cleanly and error rates are back to baseline.
    </lr-chat-message>
  `,
};

export const Roles: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 32rem;">
      <lr-chat-message data-role="system" .timestamp=${new Date()}>Conversation started.</lr-chat-message>
      <lr-chat-message data-role="user" .timestamp=${new Date()}>
        Can you check why the nightly build failed?
      </lr-chat-message>
      <lr-chat-message data-role="assistant" .timestamp=${new Date()}>
        The build failed because the "lint" step hit a type error in chart.ts — looks like an unrelated rename
        left a stale import behind.
      </lr-chat-message>
    </div>
  `,
};

export const Statuses: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 32rem;">
      <lr-chat-message data-role="user" status="sending">Deploying the hotfix now…</lr-chat-message>
      <lr-chat-message data-role="assistant" status="streaming">Looking at the last three commits</lr-chat-message>
      <lr-chat-message
        data-role="assistant"
        status="failed"
        @lr-retry=${() => alert('lr-retry fired — re-run whatever produced this message.')}
      >
        I couldn't reach the deploy service.
      </lr-chat-message>
      <lr-chat-message data-role="assistant" status="sent" .timestamp=${new Date()}>
        Done — the fix is live.
      </lr-chat-message>
    </div>
  `,
};

export const WithAvatarBadgesAndActions: Story = {
  render: () => html`
    <lr-chat-message data-role="assistant" .timestamp=${new Date()} style="max-width: 32rem; display: block;">
      <span
        slot="avatar"
        style="display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:50%;background:var(--lr-color-brand);color:var(--lr-color-on-brand);font-size:0.75rem;"
        >AI</span
      >
      <span
        slot="badges"
        style="font-size:0.6875rem;padding:0.0625rem 0.375rem;border-radius:999px;background:var(--lr-color-brand-quiet);color:var(--lr-color-brand);"
        >gpt-5.4</span
      >
      <span
        slot="badges"
        style="font-size:0.6875rem;padding:0.0625rem 0.375rem;border-radius:999px;background:var(--lr-color-surface);color:var(--lr-color-text-quiet);"
        >812 tokens · 1.4s</span
      >
      Migrating the table component to the new pagination API touches four files; want me to open a PR?
      <span slot="attachments">
        <span
          style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.75rem;padding:0.25rem 0.5rem;border:1px solid var(--lr-color-border);border-radius:0.375rem;"
          >📎 table.diff</span
        >
      </span>
      <button
        slot="actions"
        style="font:inherit;font-size:0.75rem;background:none;border:none;color:inherit;cursor:pointer;padding:0;"
        @click=${(e: Event) =>
          e.currentTarget!.dispatchEvent(
            new CustomEvent('lr-copy', { bubbles: true, composed: true, detail: { text: 'copied!' } }),
          )}
      >
        Copy
      </button>
    </lr-chat-message>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lr-chat-message
      data-role="assistant"
      collapsible
      collapsed
      .timestamp=${new Date()}
      style="max-width: 32rem; display: block;"
      @lr-collapse-toggle=${(e: CustomEvent<boolean>) => console.log('collapsed:', e.detail)}
    >
      This is a long tool-output-style message that starts collapsed — click the chevron to reveal it. Lorem ipsum
      dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna
      aliqua.
    </lr-chat-message>
  `,
};

export const CustomTimestampFormat: Story = {
  render: () => html`
    <lr-chat-message
      data-role="user"
      .timestamp=${new Date()}
      .formatTimestamp=${(date: Date) => `${date.toLocaleDateString()} · ${date.toLocaleTimeString()}`}
      style="max-width: 32rem; display: block;"
    >
      Overriding the default hour:minute rendering with a full date + time via formatTimestamp.
    </lr-chat-message>
  `,
};

export const NarrowLongContent: Story = {
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-chat-message
        data-role="assistant"
        status="failed"
        .timestamp=${new Date()}
        .strings=${{ chatFailedToSend: 'Die Nachricht konnte nicht gesendet werden' }}
      >
        This deliberately long translated-content example demonstrates wrapping in a narrow panel
        without assuming a desktop viewport.
        <button slot="actions">Try sending this message again</button>
      </lr-chat-message>
    </div>
  `,
};

export const RetimedStreamingMotion: Story = {
  render: () => html`
    <lr-chat-message
      status="streaming"
      style="--lr-transition-ambient: 3s linear"
    >
      The streaming indicator uses the shared ambient motion token.
    </lr-chat-message>
  `,
};
