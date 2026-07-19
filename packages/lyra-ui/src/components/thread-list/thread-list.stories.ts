import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './thread-list.js';
import type { ChatThread } from './thread-list.class.js';
import '../menu/menu.js';
import '../menu/menu-item.js';
import type { MenuSelectDetail } from '../menu/menu.js';

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
