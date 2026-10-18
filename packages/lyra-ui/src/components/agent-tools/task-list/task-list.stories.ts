import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './task-list.js';
import '../tool-call-chip/tool-call-chip.js';
import type { TaskItem, TaskListSource } from './task-list.class.js';

const meta: Meta = {
  title: 'TaskList',
  component: 'lr-task-list',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A live, collapsible tracker for an agent's plan: ordered steps with per-step lifecycle status and one level of nested sub-steps. Omit `heading` to localize the header; any supplied string, including 'Tasks' or an empty string, is a verbatim override.",
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

function moveTasks(tasks: readonly TaskItem[], fromIndex: number, toIndex: number): TaskItem[] {
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

export const Incomplete: Story = {
  render: () => html`<lr-task-list
    style="max-width: 32rem;"
    .items=${items.map((item) => (item.status === 'running' ? { ...item, status: 'incomplete' as const } : item))}
  ></lr-task-list>`,
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
      const { parentTaskId, fromIndex, toIndex } = (
        event as CustomEvent<{ taskId: string; parentTaskId: string | null; fromIndex: number; toIndex: number }>
      ).detail;
      list.items = reorderTasks(list.items, parentTaskId, fromIndex, toIndex);
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
  render: () => html`<lr-task-list style="max-width: 32rem;" .items=${items} collapsed></lr-task-list>`,
};

export const NonCollapsible: Story = {
  name: 'Non-collapsible level-two heading',
  render: () =>
    html`<lr-task-list
      style="max-width: 32rem;"
      heading-level="2"
      .items=${items}
      without-collapse
    ></lr-task-list>`,
};

export const DensityAndChrome: Story = {
  name: 'size="s" + frame="plain"',
  render: () => html`
    <div style="display:grid; gap:1rem; max-width:32rem;">
      <lr-task-list .items=${items}></lr-task-list>
      <lr-task-list size="s" .items=${items}></lr-task-list>
      <div style="border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); padding:0.75rem;">
        <lr-task-list frame="plain" .items=${items}></lr-task-list>
      </div>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Top to bottom: the default card, `size="s"` (tighter header/body padding, gap, and typography with chrome intact), and `frame="plain"` nested inside a container that already draws its own border — without `plain` the two frames would double up.',
      },
    },
  },
};

export const RetunedCompactHeader: Story = {
  name: 'Dense header typography rethemed',
  render: () => html`
    <lr-task-list
      size="s"
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

/** Raise the bounded projection budget while retaining the default when max-nodes is omitted. */
export const RaisedNodeLimit: Story = {
  render: () => html`<lr-task-list heading="Larger collection" max-nodes="1000"
    .items=${Array.from({length:600},(_,index)=>({id:String(index),label:`Task ${index + 1}`,status:'pending'}))}></lr-task-list>`,
};

/** Provider navigation retains only the current bounded window of a generated plan. */
export const ProviderPlan: Story = {
  render: () => {
    const count = 1_000_000;
    const treeSource: TaskListSource = { revision: 1, async project(request) {
      return { state: 'plan', total: count, summary: { total: count / 2, completed: 100_000 },
        rows: { count, keyAt: index => `task${index}`,
          indexOfKey: (key: string | number) => /^task\d+$/.test(String(key)) ? Number(String(key).slice(4)) : -1,
          itemAt: index => ({ key: `task${index}`, value: { id: `task${index}`, label: `Task ${index + 1}`, status: 'pending' },
            parentKey: index % 2 ? `task${index - 1}` : null, level: index % 2 ? 2 : 1,
            position: index % 2 ? 1 : index / 2 + 1, setSize: index % 2 ? 1 : count / 2,
            childCount: index % 2 ? 0 : 1, expanded: true, selected: false }),
        }, ...(request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(4)) } : {}),
      };
    } };
    return html`<lr-task-list heading="Generated plan" .treeSource=${treeSource}></lr-task-list>`;
  },
};
