import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './conversation-item.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'ConversationItem',
  component: 'lr-conversation-item',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A selectable row representing one chat session in a history sidebar list — the intended `renderItem()` payload for a sibling virtualized-list component, but fully usable standalone. Its selectable region uses `role="button"` and does not require a listbox owner; title/excerpt/timestamp are individual props, not a bound `.session` object, for consistency with `<lr-chat-message>`.',
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
        title="Migrating the table component"
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
        title="Nightly build failure"
        excerpt="The lint step hit a type error in chart.ts — looks like a stale import."
        .timestamp=${new Date()}
        active
      ></lr-conversation-item>
      <lr-conversation-item
        title="Deploy hotfix to staging"
        excerpt="Done — the fix is live and error rates are back to baseline."
        .timestamp=${new Date(Date.now() - 3 * 60 * 60 * 1000)}
      ></lr-conversation-item>
      <lr-conversation-item
        title="Quarterly report outline"
        .timestamp=${new Date('2024-11-02T09:15:00')}
      ></lr-conversation-item>
    </nav>
  `,
};

export const NoExcerptOrTimestamp: Story = {
  name: 'No excerpt / no timestamp',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item title="Untitled session"></lr-conversation-item>
    </nav>
  `,
};

export const LongContentTruncates: Story = {
  name: 'Long title/excerpt truncate inside a constrained width',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 16rem;">
      <lr-conversation-item
        title="A very long conversation title that should truncate with an ellipsis"
        excerpt="And an equally long last-message preview snippet that also needs to truncate on a single line instead of wrapping."
        .timestamp=${new Date()}
      ></lr-conversation-item>
    </nav>
  `,
};

export const NotEditable: Story = {
  name: 'editable=false (no rename affordance)',
  render: () => html`
    <nav aria-label="Conversations" style="max-width: 22rem;">
      <lr-conversation-item
        title="Shared conversation (read-only)"
        excerpt="Rename is unavailable for sessions this consumer doesn't own."
        .timestamp=${new Date()}
        .editable=${false}
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
        title="Click the pencil to rename me"
        .timestamp=${new Date()}
        @lr-rename=${(e: CustomEvent<{ title: string }>) => {
          const el = document.getElementById('rename-demo') as HTMLElement & { title: string };
          el.title = e.detail.title;
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
      <lr-conversation-item title="Pinned research thread" .timestamp=${new Date()} active>
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
          title="Migrating the table component"
          excerpt="Sure — I can open a PR for that."
          .timestamp=${new Date(Date.now() - 4 * 60 * 1000)}
          active
          @lr-select=${onSelect}
        ></lr-conversation-item>
        <lr-conversation-item
          title="Nightly build failure"
          excerpt="Looks like a stale import in chart.ts."
          .timestamp=${new Date(Date.now() - 55 * 60 * 1000)}
          @lr-select=${onSelect}
        ></lr-conversation-item>
        <lr-conversation-item
          title="Deploy hotfix to staging"
          excerpt="Done — the fix is live."
          .timestamp=${new Date(Date.now() - 4 * 60 * 60 * 1000)}
          @lr-select=${onSelect}
        ></lr-conversation-item>
        <lr-conversation-item
          title="Quarterly report outline"
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
        title="Overriding the default formatter"
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
        title="Click, or Tab + Enter/Space, to select me"
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
          'Set `--lr-conversation-item-active-bg` and `--lr-conversation-item-active-color` on the element or any ancestor — neither is declared on `:host`, so an ancestor value is never shadowed. Before these existed the only way to retint a selected row was to hijack library-wide `--lr-color-brand-quiet`, which repainted every other surface reading it. The two are a **contrast-sensitive pair**: the active background and the excerpt/timestamp color must stay at least 4.5:1 apart, and the title keeps `--lr-color-text`, so a dark background needs a matching title color of your own.',
      },
    },
  },
  render: () => html`
    <nav
      style="--lr-conversation-item-active-bg: ${storyColor('warningQuiet')}; --lr-conversation-item-active-color: ${storyColor(
        'text',
      )};"
    >
      <lr-conversation-item title="Themed active session" excerpt="This row is selected." .timestamp=${new Date()} active></lr-conversation-item>
      <lr-conversation-item title="Inactive session" excerpt="Untouched by the props." .timestamp=${new Date()}></lr-conversation-item>
    </nav>
  `,
};
