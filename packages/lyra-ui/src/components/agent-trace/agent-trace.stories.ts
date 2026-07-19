import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSpan } from '../trace-tree/span.js';

const spans: LyraSpan[] = [
  { id: 'root', name: 'Trip Planner', kind: 'agent', startMs: 0, endMs: 900, status: 'success' },
  {
    id: 'search',
    parentId: 'root',
    name: 'web_search',
    kind: 'tool',
    startMs: 10,
    endMs: 260,
    status: 'success',
    tokensIn: 18,
    tokensOut: 512,
    costText: '$0.0031',
    detail: 'Searching flights to Lisbon',
  },
  {
    id: 'llm',
    parentId: 'root',
    name: 'gpt-turbo',
    kind: 'llm',
    startMs: 270,
    endMs: 390,
    status: 'success',
    tokensIn: 640,
    tokensOut: 210,
    costText: '$0.0142',
  },
  { id: 'retrieve', parentId: 'llm', name: 'vector_lookup', kind: 'retriever', startMs: 300, endMs: 340, status: 'success' },
  {
    id: 'sub-agent',
    parentId: 'root',
    name: 'Research Agent',
    kind: 'agent',
    startMs: 400,
    endMs: 880,
    status: 'success',
  },
  {
    id: 'draft',
    parentId: 'sub-agent',
    name: 'draft_itinerary',
    kind: 'tool',
    startMs: 650,
    status: 'running',
  },
];

const meta: Meta = {
  title: 'Observability/Agent Trace',
  component: 'lr-agent-trace',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-agent-trace style="max-width: 44rem" .spans=${spans}></lr-agent-trace>`,
};

export const WithTokensAndCost: Story = {
  render: () => html`<lr-agent-trace style="max-width: 48rem" .spans=${spans} show-tokens show-cost></lr-agent-trace>`,
};

export const SyncedSelection: Story = {
  render: () => {
    let selected = 'llm';
    const getEl = () => document.getElementById('synced-agent-trace') as HTMLElement & { activeSpanId: string | null };
    return html`
      <lr-agent-trace
        id="synced-agent-trace"
        style="max-width: 44rem"
        .spans=${spans}
        active-span-id=${selected}
        @lr-span-select=${(e: CustomEvent<{ id: string }>) => {
          selected = e.detail.id;
          getEl().activeSpanId = selected;
        }}
      ></lr-agent-trace>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-agent-trace style="max-width: 44rem"></lr-agent-trace>`,
};

/** 320px container — the filter legend wraps, the handoff list stays full-width, and the tree
 *  falls back to its own narrow-container behavior (hides token/cost columns, then the bar). */
export const Narrow: Story = {
  render: () => html`<lr-agent-trace style="max-width: 320px" .spans=${spans} show-tokens show-cost></lr-agent-trace>`,
};
