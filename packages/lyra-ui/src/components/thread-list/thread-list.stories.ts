import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './thread-list.js';
import type { ChatThread } from './thread-list.class.js';

const meta: Meta = {
  title: 'ThreadList',
  component: 'lyra-thread-list',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The conversation sidebar: a grouped, searchable list of chat sessions with pin/archive/delete/rename affordances, built on lyra-conversation-item and virtualized via lyra-virtual-list.',
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
    html`<div style="block-size:400px;inline-size:320px;border:1px solid var(--lyra-color-border);">
      <lyra-thread-list
        searchable
        active-id="2"
        .threads=${threads}
        .rowActions=${['pin', 'archive', 'delete']}
      ></lyra-thread-list>
    </div>`,
};

export const WithArchivedShown: Story = {
  render: () =>
    html`<div style="block-size:400px;inline-size:320px;border:1px solid var(--lyra-color-border);">
      <lyra-thread-list show-archived .threads=${threads}></lyra-thread-list>
    </div>`,
};

export const FlatUngrouped: Story = {
  render: () =>
    html`<div style="block-size:400px;inline-size:320px;border:1px solid var(--lyra-color-border);">
      <lyra-thread-list grouping="none" .threads=${threads}></lyra-thread-list>
    </div>`,
};

export const SlottedMode: Story = {
  render: () => html`
    <div style="block-size:200px;inline-size:320px;border:1px solid var(--lyra-color-border);">
      <lyra-thread-list>
        <lyra-conversation-item title="Manually composed row 1"></lyra-conversation-item>
        <lyra-conversation-item title="Manually composed row 2"></lyra-conversation-item>
      </lyra-thread-list>
    </div>
  `,
};

export const Empty: Story = {
  render: () =>
    html`<div style="block-size:200px;inline-size:320px;border:1px solid var(--lyra-color-border);">
      <lyra-thread-list searchable .threads=${[]}></lyra-thread-list>
    </div>`,
};

export const Narrow320px: Story = {
  render: () =>
    html`<div style="max-width:320px;block-size:300px;border:1px dashed var(--lyra-color-border);">
      <lyra-thread-list searchable .threads=${threads} .rowActions=${['pin', 'archive', 'delete']}></lyra-thread-list>
    </div>`,
};
