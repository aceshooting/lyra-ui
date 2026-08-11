import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './task-list.js';
import '../tool-call-chip/tool-call-chip.js';
import type { TaskItem } from './task-list.class.js';

const meta: Meta = {
  title: 'TaskList',
  component: 'lr-task-list',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A live, collapsible tracker for an agent's plan: ordered steps with per-step lifecycle status and one level of nested sub-steps.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const items: TaskItem[] = [
  { id: 'step-1', label: 'Read repository structure', status: 'success' },
  {
    id: 'step-2',
    label: 'Search the web for recent changes',
    status: 'running',
    detail: 'Searching for changelog entries from the last release',
  },
  { id: 'step-3', label: 'Write summary', status: 'pending' },
];

function moveTasks(tasks: TaskItem[], fromIndex: number, toIndex: number): TaskItem[] {
  const next = [...tasks];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return next;
  next.splice(toIndex, 0, moved);
  return next;
}

function reorderTasks(
  tasks: TaskItem[],
  parentId: string | null,
  fromIndex: number,
  toIndex: number,
): TaskItem[] {
  if (parentId === null) return moveTasks(tasks, fromIndex, toIndex);
  return tasks.map((task) =>
    task.id === parentId && task.children
      ? { ...task, children: moveTasks(task.children, fromIndex, toIndex) }
      : task,
  );
}

export const Default: Story = {
  render: () => html`<lr-task-list style="max-width: 32rem;" .items=${items}></lr-task-list>`,
};

export const WithNestedSubSteps: Story = {
  render: () => html`
    <lr-task-list
      style="max-width: 32rem;"
      .items=${[
        ...items,
        {
          id: 'step-4',
          label: 'Refactor the auth module',
          status: 'error',
          detail: 'Failed while updating the last file',
          children: [
            { id: 'step-4a', label: 'Update imports', status: 'success' },
            { id: 'step-4b', label: 'Fix broken tests', status: 'error' },
          ],
        },
      ]}
    ></lr-task-list>
  `,
};

/**
 * `reorderable` turns Ctrl/Cmd+ArrowUp/ArrowDown on a focused task into a controlled request.
 * This story applies each `lr-reorder` request by creating and assigning a new `items` array.
 * Moves stay inside their current sibling group: a boundary key does nothing rather than making a
 * child a top-level task or vice versa.
 */
export const Reorderable: Story = {
  name: 'Keyboard reorderable (controlled)',
  render: () => {
    const reorderableItems: TaskItem[] = [
      {
        id: 'research',
        label: 'Research the request',
        status: 'running',
        children: [
          { id: 'sources', label: 'Collect sources', status: 'success' },
          { id: 'findings', label: 'Extract findings', status: 'pending' },
        ],
      },
      { id: 'draft', label: 'Draft response', status: 'pending' },
      { id: 'review', label: 'Review response', status: 'pending' },
    ];
    const onReorder = (event: Event): void => {
      const list = event.currentTarget as HTMLElement & { items: TaskItem[] };
      const { parentId, fromIndex, toIndex } = (
        event as CustomEvent<{ parentId: string | null; fromIndex: number; toIndex: number }>
      ).detail;
      list.items = reorderTasks(list.items, parentId, fromIndex, toIndex);
    };
    return html`
      <lr-task-list
        style="max-width: 32rem;"
        reorderable
        .items=${reorderableItems}
        @lr-reorder=${onReorder}
      ></lr-task-list>
    `;
  },
};

export const WithToolCallChipDetail: Story = {
  name: 'With a lr-tool-call-chip in a detail slot',
  render: () => html`
    <lr-task-list style="max-width: 32rem;" .items=${items}>
      <lr-tool-call-chip
        slot="detail-step-2"
        name="web_search"
        status="running"
        summary="Searching…"
      ></lr-tool-call-chip>
    </lr-task-list>
  `,
};

export const Collapsed: Story = {
  render: () => html`<lr-task-list style="max-width: 32rem;" .items=${items} expanded="false"></lr-task-list>`,
};

export const NonCollapsible: Story = {
  name: 'Non-collapsible (static heading)',
  render: () =>
    html`<lr-task-list style="max-width: 32rem;" .items=${items} collapsible="false"></lr-task-list>`,
};

export const DensityAndChrome: Story = {
  name: 'compact + frame="plain"',
  render: () => html`
    <div style="display:grid; gap:1rem; max-width:32rem;">
      <lr-task-list .items=${items}></lr-task-list>
      <lr-task-list compact .items=${items}></lr-task-list>
      <div style="border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); padding:0.75rem;">
        <lr-task-list frame="plain" .items=${items}></lr-task-list>
      </div>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Top to bottom: the default card, `compact` (tighter header/body padding, gap, and typography with chrome intact), and `frame="plain"` nested inside a container that already draws its own border — without `plain` the two frames would double up.',
      },
    },
  },
};

export const RetunedCompactHeader: Story = {
  name: 'Compact header typography rethemed',
  render: () => html`
    <lr-task-list
      compact
      style="max-width: 32rem; --lr-task-list-compact-header-font-size: var(--lr-font-size-xs);"
      .items=${items}
    ></lr-task-list>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px, long content)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-task-list
        expanded
        .items=${[
          ...items,
          {
            id: 'long',
            label: `task-${'identifier'.repeat(20)}`,
            detail: `detail-${'identifier'.repeat(20)}`,
            status: 'running',
          },
        ]}
      ></lr-task-list>
    </div>
  `,
};
