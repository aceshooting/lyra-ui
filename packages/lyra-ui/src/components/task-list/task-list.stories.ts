import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './task-list.js';
import '../tool-call-chip/tool-call-chip.js';
import type { TaskItem } from './task-list.class.js';

const meta: Meta = {
  title: 'TaskList',
  component: 'lyra-task-list',
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

export const Default: Story = {
  render: () => html`<lyra-task-list style="max-width: 32rem;" .items=${items}></lyra-task-list>`,
};

export const WithNestedSubSteps: Story = {
  render: () => html`
    <lyra-task-list
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
    ></lyra-task-list>
  `,
};

export const WithToolCallChipDetail: Story = {
  name: 'With a lyra-tool-call-chip in a detail slot',
  render: () => html`
    <lyra-task-list style="max-width: 32rem;" .items=${items}>
      <lyra-tool-call-chip
        slot="detail-step-2"
        name="web_search"
        status="running"
        summary="Searching…"
      ></lyra-tool-call-chip>
    </lyra-task-list>
  `,
};

export const Collapsed: Story = {
  render: () => html`<lyra-task-list style="max-width: 32rem;" .items=${items} expanded="false"></lyra-task-list>`,
};

export const NonCollapsible: Story = {
  name: 'Non-collapsible (static heading)',
  render: () =>
    html`<lyra-task-list style="max-width: 32rem;" .items=${items} collapsible="false"></lyra-task-list>`,
};

export const Narrow320: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lyra-task-list .items=${items}></lyra-task-list>
    </div>
  `,
};
