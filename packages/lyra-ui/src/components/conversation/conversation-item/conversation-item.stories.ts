import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './conversation-item.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'ConversationItem',
  component: 'lr-conversation-item',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A selectable row representing one chat session in a history sidebar list — the intended `renderItem()` payload for a sibling virtualized-list component, but fully usable standalone. Its selectable region uses `role="button"` and does not require a listbox owner; label/excerpt/timestamp are individual props, not a bound `.session` object, for consistency with `<lr-chat-message>`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item
        label="Migrating the table component"
        excerpt="Sure — I can open a PR that swaps the old pagination prop for the new cursor-based API."
        .timestamp=${new Date()}
      ></lr-conversation-item>
    </nav>
  `,
};

export const ActiveAndInactive: Story = {
  render: () => html`
    <nav aria-label="Conversations" style="display:flex;flex-direction:column;gap:0.125rem;max-width:22rem;">
      <lr-conversation-item
        label="Nightly build failure"
        excerpt="The lint step hit a type error in chart.ts — looks like a stale import."
        .timestamp=${new Date()}
        active
      ></lr-conversation-item>
      <lr-conversation-item
        label="Deploy hotfix to staging"
        excerpt="Done — the fix is live and error rates are back to baseline."
        .timestamp=${new Date(Date.now() - 3 * 60 * 60 * 1000)}
      ></lr-conversation-item>
      <lr-conversation-item
        label="Quarterly report outline"
        .timestamp=${new Date('2024-11-02T09:15:00')}
      ></lr-conversation-item>
    </nav>
  `,
};

export const NoExcerptOrTimestamp: Story = {
  name: 'No excerpt / no timestamp',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item label="Untitled session"></lr-conversation-item>
    </nav>
  `,
};

export const LongContentTruncates: Story = {
  name: 'Long title/excerpt truncate inside a constrained width',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 16rem;">
      <lr-conversation-item
        label="A very long conversation title that should truncate with an ellipsis"
        excerpt="And an equally long last-message preview snippet that also needs to truncate on a single line instead of wrapping."
        .timestamp=${new Date()}
      ></lr-conversation-item>
    </nav>
  `,
};

export const Compact: Story = {
  name: 'compact (density)',
  parameters: {
    docs: {
      description: {
        story:
          'Tightens `[part="base"]`\'s padding and gap and collapses `[part="content"]`\'s inter-line gap — retune either through `--lr-conversation-item-compact-padding`/`--lr-conversation-item-compact-gap` on the row or any ancestor. It deliberately leaves the rename button at the shared `--lr-icon-button-size` target floor, so a row with a rename affordance still floors at roughly that height; a row with `renamable=false` and no `actions` collapses much further.',
      },
    },
  },
  render: () => html`
    <div style="display:flex;gap:2rem;align-items:flex-start;">
      <nav aria-label="Conversations (comfortable)" style="display:flex;flex-direction:column;width:20rem;">
        <lr-conversation-item
          label="Nightly build failure"
          excerpt="The lint step hit a type error in chart.ts."
          .timestamp=${new Date()}
          active
        ></lr-conversation-item>
        <lr-conversation-item
          label="Deploy hotfix to staging"
          excerpt="Done — the fix is live."
          .timestamp=${new Date(Date.now() - 3 * 60 * 60 * 1000)}
        ></lr-conversation-item>
      </nav>
      <nav aria-label="Conversations (compact)" style="display:flex;flex-direction:column;width:20rem;">
        <lr-conversation-item
          compact
          label="Nightly build failure"
          excerpt="The lint step hit a type error in chart.ts."
          .timestamp=${new Date()}
          active
        ></lr-conversation-item>
        <lr-conversation-item
          compact
          label="Deploy hotfix to staging"
          excerpt="Done — the fix is live."
          .timestamp=${new Date(Date.now() - 3 * 60 * 60 * 1000)}
        ></lr-conversation-item>
        <lr-conversation-item
          compact
          .renamable=${false}
          label="Read-only session (no rename affordance)"
          excerpt="Nothing floors this row's height, so compact tightens it the most."
          .timestamp=${new Date(Date.now() - 26 * 60 * 60 * 1000)}
        ></lr-conversation-item>
      </nav>
    </div>
  `,
};

export const NotEditable: Story = {
  name: 'renamable=false (no rename affordance)',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item
        label="Shared conversation (read-only)"
        excerpt="Rename is unavailable for sessions this consumer doesn't own."
        .timestamp=${new Date()}
        .renamable=${false}
      ></lr-conversation-item>
    </nav>
  `,
};

export const InlineRename: Story = {
  name: 'Inline rename — click the pencil, Enter/blur commits, Escape cancels',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item
        id="rename-demo"
        label="Click the pencil to rename me"
        .timestamp=${new Date()}
        conversation-id="rename-demo-conversation"
        @lr-rename=${(e: CustomEvent<{ conversationId: string; label: string }>) => {
          const el = document.getElementById('rename-demo') as HTMLElement & { label: string };
          el.label = e.detail.label;
          const out = document.getElementById('conversation-item-rename-log');
          if (out) out.textContent = `lr-rename: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-conversation-item>
      <p id="conversation-item-rename-log" style="font-family: monospace; margin-top: 0.5rem;">
        No rename committed yet.
      </p>
    </nav>
  `,
};

export const WithActionsSlot: Story = {
  name: 'actions slot (e.g. a pin/delete control)',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item label="Pinned research thread" .timestamp=${new Date()} active>
        <button
          slot="actions"
          type="button"
          aria-label="Delete conversation"
          style="font:inherit;background:none;border:none;color:inherit;cursor:pointer;padding:0.25rem;"
          @click=${(e: Event) => {
            e.stopPropagation();
            alert('Delete clicked — the row itself was not selected.');
          }}
        >
          ✕
        </button>
      </lr-conversation-item>
    </nav>
  `,
};

export const WithStartSlot: Story = {
  name: 'start slot (non-interactive adornment)',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item label="Deployment status" excerpt="Production is healthy." .timestamp=${new Date()}>
        <span slot="start" aria-hidden="true" style="color:var(--lr-color-success);">●</span>
      </lr-conversation-item>
    </nav>
  `,
};

export const HistoryList: Story = {
  name: 'A realistic history sidebar list',
  render: () => {
    const onSelect = (e: Event) => {
      const clicked = e.currentTarget as HTMLElement;
      const list = clicked.closest('nav')!;
      for (const item of list.querySelectorAll('lr-conversation-item')) item.removeAttribute('active');
      clicked.setAttribute('active', '');
    };
    return html`
      <nav
        aria-label="Conversations"
        style="display:flex;flex-direction:column;gap:0.125rem;max-width:22rem;border:1px solid var(--lr-color-border);border-radius:0.5rem;padding:0.25rem;"
      >
        <lr-conversation-item
          label="Migrating the table component"
          excerpt="Sure — I can open a PR for that."
          .timestamp=${new Date(Date.now() - 4 * 60 * 1000)}
          active
          @lr-select=${onSelect}
        ></lr-conversation-item>
        <lr-conversation-item
          label="Nightly build failure"
          excerpt="Looks like a stale import in chart.ts."
          .timestamp=${new Date(Date.now() - 55 * 60 * 1000)}
          @lr-select=${onSelect}
        ></lr-conversation-item>
        <lr-conversation-item
          label="Deploy hotfix to staging"
          excerpt="Done — the fix is live."
          .timestamp=${new Date(Date.now() - 4 * 60 * 60 * 1000)}
          @lr-select=${onSelect}
        ></lr-conversation-item>
        <lr-conversation-item
          label="Quarterly report outline"
          .timestamp=${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)}
          @lr-select=${onSelect}
        ></lr-conversation-item>
      </nav>
    `;
  },
};

export const CustomTimestampFormat: Story = {
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item
        label="Overriding the default formatter"
        excerpt="formatTimestamp swaps the built-in absolute-time rendering for anything a consumer wants."
        .timestamp=${new Date()}
        .formatTimestamp=${(date: Date) => `${date.toLocaleDateString()} · ${date.toLocaleTimeString()}`}
      ></lr-conversation-item>
    </nav>
  `,
};

export const Events: Story = {
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item
        id="ci-events"
        label="Click, or Tab + Enter/Space, to select me"
        .timestamp=${new Date()}
        @lr-select=${(e: Event) => {
          const out = document.getElementById('conversation-item-event-log');
          if (out) out.textContent = `lr-select fired on #${(e.currentTarget as HTMLElement).id}`;
        }}
      ></lr-conversation-item>
      <p id="conversation-item-event-log" style="font-family: monospace; margin-top: 0.5rem;">No event fired yet.</p>
    </nav>
  `,
};

export const ThemedActiveRow: Story = {
  name: 'Themed active row (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          'Set `--lr-conversation-item-active-bg` and `--lr-conversation-item-active-color` on the element or any ancestor — neither is declared on `:host`, so an ancestor value is never shadowed. Before these existed the only way to retint a selected row was to hijack library-wide `--lr-color-brand-quiet`, which repainted every other surface reading it. The two are a **contrast-sensitive pair**: the active background and the excerpt/timestamp color must stay at least 4.5:1 apart, and the label keeps `--lr-color-text`, so a dark background needs a matching title color of your own.',
      },
    },
  },
  render: () => html`
    <nav
      style="--lr-conversation-item-active-bg: ${storyColor('warningQuiet')}; --lr-conversation-item-active-color: ${storyColor(
        'text',
      )};"
    >
      <lr-conversation-item label="Themed active session" excerpt="This row is selected." .timestamp=${new Date()} active></lr-conversation-item>
      <lr-conversation-item label="Inactive session" excerpt="Untouched by the props." .timestamp=${new Date()}></lr-conversation-item>
    </nav>
  `,
};

export const ActiveIndicator: Story = {
  name: 'Active row indicator',
  parameters: {
    docs: {
      description: {
        story:
          'The active row renders an `active-indicator` part at logical inline-start. Retune its color, width, or inline placement through the component-scoped tokens, or style the part directly.',
      },
    },
  },
  render: () => html`
    <nav style="display:flex;flex-direction:column;gap:0.125rem;max-width:22rem;">
      <lr-conversation-item
        label="Active with a custom indicator"
        excerpt="The indicator is a supported part rather than host-generated row markup."
        active
        style="--lr-conversation-item-active-indicator-color: var(--lr-color-warning); --lr-conversation-item-active-indicator-width: var(--lr-size-4px);"
      ></lr-conversation-item>
      <lr-conversation-item label="Inactive row" excerpt="No indicator is rendered while inactive."></lr-conversation-item>
    </nav>
  `,
};
