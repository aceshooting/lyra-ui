import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "../../lr-chat-message.js";
import '../../lr-copy-button.js';

const storyLocale = (): string => document.documentElement.lang || navigator.language;

const meta: Meta = {
  title: "ChatMessage",
  component: "lr-chat-message",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'A role-based message bubble shell for a chat/agent conversation surface. The role-owning article is directly named with the localized author identity unless a host aria-label override is present. The default slot carries the message body; the component supplies alignment, status, attachments, and action chrome.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-chat-message
      message-role="assistant"
      .timestamp=${new Date()}
      style="max-width: 32rem; display: block;"
    >
      Here's a summary of the last deploy: three services restarted cleanly and
      error rates are back to baseline.
    </lr-chat-message>
  `,
};

export const Roles: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 32rem;"
    >
      <lr-chat-message message-role="system" .timestamp=${new Date()}
        >Conversation started.</lr-chat-message
      >
      <lr-chat-message message-role="user" .timestamp=${new Date()}>
        Can you check why the nightly build failed?
      </lr-chat-message>
      <lr-chat-message message-role="assistant" .timestamp=${new Date()}>
        The build failed because the "lint" step hit a type error in chart.ts —
        looks like an unrelated rename left a stale import behind.
      </lr-chat-message>
    </div>
  `,
};

export const Statuses: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 32rem;"
    >
      <lr-chat-message message-role="user" status="sending"
        >Deploying the hotfix now…</lr-chat-message
      >
      <lr-chat-message message-role="assistant" status="streaming"
        >Looking at the last three commits</lr-chat-message
      >
      <lr-chat-message
        message-role="assistant"
        status="failed"
        @lr-message-retry=${() =>
          alert(
            "lr-message-retry fired — re-run whatever produced this message."
          )}
      >
        I couldn't reach the deploy service.
      </lr-chat-message>
      <lr-chat-message
        message-role="assistant"
        status="sent"
        .timestamp=${new Date()}
      >
        Done — the fix is live.
      </lr-chat-message>
    </div>
  `,
};

export const CustomFailureSlot: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 32rem;"
    >
      <lr-chat-message
        message-role="assistant"
        status="failed"
        style="max-width: 32rem; display: block;"
      >
        This message uses the built-in failed treatment -- no failure slot
        content, so the default status text and retry button are unchanged from
        before this slot existed.
      </lr-chat-message>
      <lr-chat-message
        message-role="assistant"
        status="failed"
        style="max-width: 32rem; display: block;"
      >
        The consumer's own alert banner (below) fully replaces the built-in
        status text and retry button -- there is exactly one failure
        presentation, not two stacked on top of each other.
        <div
          slot="failure"
          role="alert"
          style="display:flex;align-items:center;gap:0.5rem;margin-block-start:0.5rem;padding:0.5rem 0.75rem;border-radius:0.375rem;background:var(--lr-color-danger-quiet);color:var(--lr-color-danger);font-weight:600;"
        >
          <span>Send failed — the deploy service didn't respond.</span>
          <button
            type="button"
            style="font:inherit;background:none;border:none;padding:0;color:inherit;text-decoration:underline;cursor:pointer;"
            @click=${(e: Event) =>
              (e.currentTarget as HTMLElement).dispatchEvent(
                new CustomEvent("lr-message-retry", {
                  bubbles: true,
                  composed: true,
                })
              )}
          >
            Retry
          </button>
        </div>
      </lr-chat-message>
    </div>
  `,
};

const copyableMessage =
  'Migrating the table component to the new pagination API touches four files; want me to open a PR?';

export const WithAvatarBadgesAndActions: Story = {
  render: () => html`
    <lr-chat-message
      message-role="assistant"
      .timestamp=${new Date()}
      style="max-width: 32rem; display: block;"
    >
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
      ${copyableMessage}
      <span slot="attachments">
        <span
          style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.75rem;padding:0.25rem 0.5rem;border:1px solid var(--lr-color-border);border-radius:0.375rem;"
          >📎 table.diff</span
        >
      </span>
      <lr-copy-button slot="actions" .value=${copyableMessage} copy-label="Copy">
        <span slot="copy-icon">Copy</span>
      </lr-copy-button>
    </lr-chat-message>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lr-chat-message
      message-role="assistant"
      collapsible
      collapsed
      .timestamp=${new Date()}
      style="max-width: 32rem; display: block;"
      @lr-toggle=${(e: CustomEvent<{ expanded: boolean }>) =>
        console.log("expanded:", e.detail.expanded)}
    >
      This is a long tool-output-style message that starts collapsed — click the
      chevron to reveal it. Lorem ipsum dolor sit amet, consectetur adipiscing
      elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    </lr-chat-message>
  `,
};

export const CustomTimestampFormat: Story = {
  render: () => html`
    <lr-chat-message
      message-role="user"
      .timestamp=${new Date()}
      .formatTimestamp=${(date: Date) =>
        `${date.toLocaleDateString(storyLocale())} · ${date.toLocaleTimeString(storyLocale())}`}
      style="max-width: 32rem; display: block;"
    >
      Overriding the default hour:minute rendering with a full date + time via
      formatTimestamp.
    </lr-chat-message>
  `,
};

export const NarrowLongContent: Story = {
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-chat-message
        message-role="assistant"
        status="failed"
        .timestamp=${new Date()}
        .strings=${{
          chatFailedToSend: "Die Nachricht konnte nicht gesendet werden",
        }}
      >
        This deliberately long translated-content example demonstrates wrapping
        in a narrow panel without assuming a desktop viewport.
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

export const BubbleGeometry: Story = {
  name: "Retuned bubble padding/radius",
  parameters: {
    docs: {
      description: {
        story:
          "`--lr-chat-message-bubble-padding` and `--lr-chat-message-bubble-radius` reshape only the bubble geometry. The unrelated `failed`/`streaming` paint remains intact, and the bubble-only radius leaves `retry-button` on the shared `--lr-radius`.",
      },
    },
  },
  render: () => html`
    <div
      style="display:flex; flex-direction:column; gap:0.75rem; --lr-chat-message-bubble-padding:1.25rem 1.5rem; --lr-chat-message-bubble-radius:1.25rem;"
    >
      <lr-chat-message message-role="user"
        >Tight rounded bubble, unchanged user tint.</lr-chat-message
      >
      <lr-chat-message status="streaming"
        >Streaming keeps its brand border.</lr-chat-message
      >
      <lr-chat-message status="failed"
        >Failed keeps its danger tint and retry button.</lr-chat-message
      >
    </div>
  `,
};

export const AvatarBesideBody: Story = {
  name: "Avatar beside the body, borderless",
  parameters: {
    docs: {
      description: {
        story:
          "`avatar-placement=\"start\"` (or `\"end\"`) places the avatar beside the body and centres the badges alongside it. `--lr-chat-message-bubble-border-width: 0` and a transparent `--lr-chat-message-bubble-bg` turn the assistant bubble into plain text.",
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:var(--lr-space-s); max-width:32rem; --lr-chat-message-assistant-bubble-padding:0; --lr-chat-message-user-bubble-padding:var(--lr-space-xs) var(--lr-space-m); --lr-chat-message-user-bubble-radius:var(--lr-radius-pill);">
      <lr-chat-message
        message-role="assistant"
        avatar-placement="start"
        style="--lr-chat-message-bubble-border-width: 0; --lr-chat-message-bubble-bg: transparent;"
      >
        <span slot="avatar" aria-hidden="true" style="font-size:var(--lr-font-size-xl);">🤖</span>
        <strong slot="badges">Assistant</strong>
        Plain reply text with the avatar at the side, as in common chat designs.
      </lr-chat-message>
      <lr-chat-message message-role="user" avatar-placement="end">
        <span slot="avatar" aria-hidden="true" style="font-size:var(--lr-font-size-xl);">🙂</span>
        <strong slot="badges">You</strong>
        A user turn with the avatar at the inline end.
      </lr-chat-message>
    </div>
  `,
};

export const FitContentBubbles: Story = {
  name: "Bubbles sized to content",
  parameters: {
    docs: {
      description: {
        story:
          "`--lr-chat-message-width: fit-content` shrinks each bubble to its content, capped by `--lr-chat-message-max-width`, while it stays on its role's side.",
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem; --lr-chat-message-width: fit-content;">
      <lr-chat-message message-role="user">Hi</lr-chat-message>
      <lr-chat-message message-role="assistant">Hello! How can I help?</lr-chat-message>
      <lr-chat-message message-role="user">
        A longer message still wraps at the maximum width instead of growing past it.
      </lr-chat-message>
    </div>
  `,
};

export const SilentStatus: Story = {
  name: "Status announcements off",
  parameters: {
    docs: {
      description: {
        story:
          "`announce-status=\"false\"` silences the built-in failure and streaming-complete live-region announcements while keeping the visible status text, for applications that announce each reply themselves.",
      },
    },
  },
  render: () => html`
    <lr-chat-message message-role="assistant" status="streaming" announce-status="false">
      Streaming without a built-in completion announcement.
    </lr-chat-message>
  `,
};

export const FailedOnDarkUserBubble: Story = {
  name: "Failed text color on a dark user bubble",
  parameters: {
    docs: {
      description: {
        story:
          "`--lr-chat-message-failed-color` paints failed bubble text, so white user text on a brand fill stays readable once the failed fill replaces it.",
      },
    },
  },
  render: () => html`
    <div
      style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem; --lr-chat-message-user-bubble-bg: var(--lr-color-brand); --lr-chat-message-user-bubble-color: var(--lr-color-on-brand); --lr-chat-message-user-footer-color: var(--lr-color-on-brand);"
    >
      <lr-chat-message message-role="user">Sent on the dark brand fill.</lr-chat-message>
      <lr-chat-message message-role="user" status="failed">This one failed to send.</lr-chat-message>
    </div>
  `,
};
