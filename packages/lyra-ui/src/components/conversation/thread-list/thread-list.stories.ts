import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './thread-list.js';
import type { ChatThread } from './thread-list.class.js';
import '../../layout/menu/menu.js';
import '../../layout/menu/menu-item.js';
import '../../overlays/badge/badge.js';
import type { MenuSelectDetail } from '../../layout/menu/menu.js';

const meta: Meta = {
  title: 'ThreadList',
  component: 'lr-thread-list',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The conversation sidebar: a grouped, searchable list of chat sessions with pin/archive/delete/rename affordances, built on lr-conversation-item and virtualized via lr-virtual-list.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

const threads: ChatThread[] = [
  { id: '1', title: 'Deploy pipeline investigation', pinned: true, timestamp: hoursAgo(2) },
  { id: '2', title: 'Refactor the auth module', excerpt: 'Can you check why the token refresh…', timestamp: hoursAgo(1) },
  { id: '3', title: 'Weekly summary draft', timestamp: hoursAgo(20) },
  { id: '4', title: 'Onboarding doc review', timestamp: daysAgo(3) },
  { id: '5', title: 'Old Q1 planning thread', timestamp: daysAgo(45) },
  { id: '6', title: 'Archived spike', archived: true, timestamp: daysAgo(10) },
];

export const Default: Story = {
  render: () =>
    html`<div style="block-size:400px;inline-size:320px;border:1px solid var(--lr-color-border);">
      <lr-thread-list
        searchable
        active-id="2"
        .threads=${threads}
        .rowActions=${['pin', 'archive', 'delete']}
      ></lr-thread-list>
    </div>`,
};

/** `renderActions` replaces the built-in pin/archive/delete icon buttons with a fully custom
 *  per-row menu -- the shape a consumer with its own richer row-action surface (a `<lr-menu>` with
 *  Rename/Delete, a rename dialog, delete-confirmation state, etc.) needs instead of `rowActions`'
 *  closed `pin | archive | delete` set. `rowActions` is left unset here, so nothing built-in
 *  precedes the menu in the `actions` slot -- setting both would append this menu after the
 *  built-in buttons instead. */
export const CustomRowActions: Story = {
  render: () =>
    html`<div style="block-size:400px;inline-size:320px;border:1px solid var(--lr-color-border);">
      <lr-thread-list
        searchable
        active-id="2"
        .threads=${threads}
        .renderActions=${(thread: ChatThread) => html`
          <lr-menu label="Conversation actions" placement="bottom-end">
            <button
              slot="trigger"
              aria-label="Conversation actions"
              style="border:none;background:none;cursor:pointer;font-size:1.25rem;line-height:1;padding:0.25rem;"
            >
              ⋮
            </button>
            <lr-menu-item
              value="rename"
              @lr-menu-select=${(e: CustomEvent<MenuSelectDetail>) =>
                console.log('rename', thread.id, e.detail.value)}
              >Rename</lr-menu-item
            >
            <lr-menu-item
              value="delete"
              destructive
              @lr-menu-select=${(e: CustomEvent<MenuSelectDetail>) =>
                console.log('delete', thread.id, e.detail.value)}
              >Delete</lr-menu-item
            >
          </lr-menu>
        `}
      ></lr-thread-list>
    </div>`,
};

export const WithArchivedShown: Story = {
  render: () =>
    html`<div style="block-size:400px;inline-size:320px;border:1px solid var(--lr-color-border);">
      <lr-thread-list show-archived .threads=${threads}></lr-thread-list>
    </div>`,
};

export const FlatUngrouped: Story = {
  render: () =>
    html`<div style="block-size:400px;inline-size:320px;border:1px solid var(--lr-color-border);">
      <lr-thread-list grouping="none" .threads=${threads}></lr-thread-list>
    </div>`,
};

export const SlottedMode: Story = {
  render: () => html`
    <div style="block-size:200px;inline-size:320px;border:1px solid var(--lr-color-border);">
      <lr-thread-list>
        <lr-conversation-item title="Manually composed row 1"></lr-conversation-item>
        <lr-conversation-item title="Manually composed row 2"></lr-conversation-item>
      </lr-thread-list>
    </div>
  `,
};

export const Empty: Story = {
  render: () =>
    html`<div style="block-size:200px;inline-size:320px;border:1px solid var(--lr-color-border);">
      <lr-thread-list searchable .threads=${[]}></lr-thread-list>
    </div>`,
};

export const Narrow320px: Story = {
  render: () =>
    html`<div style="max-width:320px;block-size:300px;border:1px dashed var(--lr-color-border);">
      <lr-thread-list searchable .threads=${threads} .rowActions=${['pin', 'archive', 'delete']}></lr-thread-list>
    </div>`,
};

export const RenderHooks: Story = {
  render: () => html`
    <style>
      .hook-parts::part(viewport) {
        scrollbar-color: var(--lr-color-brand) var(--lr-color-surface);
        scrollbar-gutter: stable;
      }
      .hook-parts::part(row-leading),
      .hook-parts::part(row-meta) {
        display: inline-flex;
        gap: var(--lr-space-xs);
        --lr-theme-color-brand-fill-loud: var(--lr-color-success);
      }
      .hook-parts::part(row-content) {
        display: grid;
        gap: var(--lr-space-2xs);
      }
    </style>
    <div style="block-size:400px;inline-size:360px;border:1px solid var(--lr-color-border);">
      <lr-thread-list
        class="hook-parts"
        .threads=${threads}
        .renderLeading=${(thread: ChatThread) => html`<lr-badge variant=${thread.pinned ? 'brand' : 'neutral'}>AI</lr-badge>`}
        .renderMeta=${(thread: ChatThread) => html`<span>${thread.archived ? 'Archived' : 'Knowledge base'}</span>`}
        .renderRowContent=${(thread: ChatThread) => html`
          <strong>${thread.title}</strong>
          <small>${thread.excerpt ?? 'No preview available'}</small>
        `}
        .formatGroupLabel=${(key: string) => `Group: ${key}`}
      ></lr-thread-list>
    </div>
  `,
};

/** Row density from the outside, with no token override. In data mode this component builds each
 *  `<lr-conversation-item>` itself two shadow roots down, and forwards the item's own parts out
 *  under the `row-item-*` namespace (`row-*` is the separate wrapper surface around this
 *  component's render-callback output). Setting `::part(row-item-base)`/`::part(row-item-title)`
 *  reaches exactly the two declarations that set row height -- and, unlike the
 *  `::part(row) { --lr-theme-space-s: … }` retheme it replaces, it does *not* leak into the
 *  `renderActions` menu, whose items stay at full size and above the touch-target floor. Opening
 *  the first row's menu also shows the row-stacking fix: a focused row paints over the rows below
 *  it, so the popup is readable rather than covered by rows 2 and 3. */
export const DenseRows: Story = {
  render: () => html`
    <style>
      .dense-rows::part(row-item-base) {
        padding-block: var(--lr-space-2xs);
        padding-inline: var(--lr-space-s);
      }
      .dense-rows::part(row-item-title) {
        font-size: var(--lr-font-size-sm);
      }
      .dense-rows::part(row-item-timestamp) {
        font-size: var(--lr-font-size-2xs);
      }
    </style>
    <div style="block-size:400px;inline-size:320px;border:1px solid var(--lr-color-border);">
      <lr-thread-list
        class="dense-rows"
        active-id="2"
        .threads=${threads}
        .renderActions=${(thread: ChatThread) => html`
          <lr-menu label="Conversation actions" placement="bottom-end">
            <button
              slot="trigger"
              aria-label="Conversation actions"
              style="border:none;background:none;cursor:pointer;font-size:1.25rem;line-height:1;padding:0.25rem;"
            >
              ⋮
            </button>
            <lr-menu-item
              value="rename"
              @lr-menu-select=${(e: CustomEvent<MenuSelectDetail>) => console.log('rename', thread.id, e.detail.value)}
              >Rename</lr-menu-item
            >
            <lr-menu-item
              value="delete"
              destructive
              @lr-menu-select=${(e: CustomEvent<MenuSelectDetail>) => console.log('delete', thread.id, e.detail.value)}
              >Delete</lr-menu-item
            >
          </lr-menu>
        `}
      ></lr-thread-list>
    </div>
  `,
};

/** `compact` is a pure forwarding property: it sets `compact` on every data-mode row
 *  `<lr-conversation-item>`, which is where the density actually lives. It is the one-attribute
 *  version of the `::part(row-item-*)` styling above -- reach for the parts when the tuning goes
 *  beyond the row's own density knob. Slotted mode is a deliberate no-op: that mode renders
 *  host-supplied items as-is, so a host sets `compact` on its own items there. */
export const CompactRows: Story = {
  name: 'compact (forwarded row density)',
  render: () => html`
    <div style="display:flex;gap:1rem;">
      <div style="block-size:400px;inline-size:320px;border:1px solid var(--lr-color-border);">
        <lr-thread-list active-id="2" .threads=${threads}></lr-thread-list>
      </div>
      <div style="block-size:400px;inline-size:320px;border:1px solid var(--lr-color-border);">
        <lr-thread-list compact active-id="2" .threads=${threads}></lr-thread-list>
      </div>
    </div>
  `,
};

interface ProjectThread extends ChatThread {
  project: string;
}

const projectThreads: ProjectThread[] = [
  { id: 'p-1', title: 'Authentication follow-up', project: 'Platform' },
  { id: 'p-2', title: 'Release checklist', project: 'Viewer' },
  { id: 'p-3', title: 'Keyboard audit', project: 'Viewer' },
];

export const ControlledProjectGroups: Story = {
  render: () => html`
    <div style="block-size:400px;inline-size:360px;border:1px solid var(--lr-color-border);">
      <lr-thread-list
        grouping="custom"
        .threads=${projectThreads}
        .groupBy=${(thread: ChatThread) => (thread as ProjectThread).project}
        .groupOrder=${['Viewer', 'Platform']}
        .formatGroup=${(id: string, grouped: ChatThread[]) => html`<strong>${id}</strong> (${grouped.length})`}
        .collapsedGroupIds=${['Platform']}
        @lr-group-toggle=${(event: CustomEvent) => console.log('controlled group intent', event.detail)}
      ></lr-thread-list>
    </div>
  `,
};

/** `wrapRow` composes host-owned content around the whole built-in row -- here a trailing tag strip
 *  that has no home in `lr-conversation-item`'s own title/excerpt/meta/actions surface. Its return
 *  value is placed inside a library-owned `part="row-wrapper"`, so the wrapped row can be laid out
 *  from outside (`::part(row-wrapper)`) without threading a class through the callback. The wrapper
 *  is an unstyled block box, so adding it leaves the virtual list's measured row heights unchanged;
 *  the part is row-only -- group headers never pass through `wrapRow`. */
export const WrappedRows: Story = {
  render: () => html`
    <style>
      .wrapped-rows::part(row-wrapper) {
        display: flex;
        flex-direction: column;
        gap: var(--lr-space-2xs);
        padding-block-end: var(--lr-space-xs);
        border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
      }
      .wrapped-rows .row-tags {
        display: flex;
        gap: var(--lr-space-2xs);
        padding-inline: var(--lr-space-m);
      }
    </style>
    <div style="block-size:400px;inline-size:360px;border:1px solid var(--lr-color-border);">
      <lr-thread-list
        class="wrapped-rows"
        .threads=${threads}
        .wrapRow=${(thread: ChatThread, row: unknown) => html`
          ${row}
          <span class="row-tags">
            <lr-badge variant=${thread.pinned ? 'brand' : 'neutral'}>${thread.pinned ? 'Pinned' : 'Chat'}</lr-badge>
            ${thread.archived ? html`<lr-badge variant="neutral">Archived</lr-badge>` : null}
          </span>
        `}
      ></lr-thread-list>
    </div>
  `,
};

/** No consumer CSS: the internal `lr-virtual-list` fills whatever height this component was given,
 *  rather than scrolling inside `--lr-virtual-list-height`'s 24rem default. In an auto-height
 *  container (no `block-size` on the pane) the list still falls back to that 24rem default. */
export const FillsItsContainer: Story = {
  render: () => html`
    <div style="display:flex;gap:var(--lr-space-l);align-items:flex-start;">
      <div style="block-size:600px;inline-size:320px;border:1px solid var(--lr-color-border);">
        <lr-thread-list searchable .threads=${threads}></lr-thread-list>
      </div>
      <div style="inline-size:320px;border:1px solid var(--lr-color-border);">
        <lr-thread-list searchable .threads=${threads}></lr-thread-list>
      </div>
    </div>
  `,
};
