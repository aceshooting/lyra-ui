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
  parameters: { docs: { description: { component: 'Span views omit whitespace-only IDs and preserve every nonblank business ID exactly, including surrounding whitespace. The first valid admitted duplicate continues to win.' } } },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-agent-trace style="max-width: 44rem" .spans=${spans}></lr-agent-trace>`,
};

export const WithTokensAndCost: Story = {
  render: () => html`<lr-agent-trace style="max-width: 48rem" .spans=${spans} with-tokens with-cost></lr-agent-trace>`,
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
        @lr-span-select=${(e: CustomEvent<{ spanId: string }>) => {
          selected = e.detail.spanId;
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
  render: () => html`<lr-agent-trace style="max-width: 320px" .spans=${spans} with-tokens with-cost></lr-agent-trace>`,
};

export const RetintedActiveHandoff: Story = {
  name: 'Retinted active handoff',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-agent-trace-handoff-active-bg` recolors the active (`activeSpanId`) handoff quick-jump entry on its own. `::part(handoff)[data-active]` is invalid CSS, so without this property the active entry could only be restyled by overriding the library-wide `--lr-color-brand-quiet` token. Unset, it renders exactly as before.',
      },
    },
  },
  render: () =>
    html`<lr-agent-trace
      style="max-width: 44rem; --lr-agent-trace-handoff-active-bg: var(--lr-color-success-quiet)"
      .spans=${spans}
      active-span-id="sub-agent"
    ></lr-agent-trace>`,
};

/** Raise the bounded projection budget while retaining the default when max-nodes is omitted. */
export const RaisedNodeLimit: Story = {
  render: () => html`<lr-agent-trace label="Larger collection" max-nodes="1000"
    .spans=${Array.from({length:600},(_,index)=>({id:String(index),name:`Span ${index + 1}`,kind:'tool',status:'success',startMs:index,endMs:index+1}))}></lr-agent-trace>`,
};

export const MillionSource: Story = {
  render: () => {
    const count = 1_000_000;
    const source: import('./agent-trace.class.js').TraceTreeSource = {
      revision: 1,
      async project(request) {
        const visible = request.query.hiddenKinds.includes('tool') ? 0 : count;
        return { state: String(visible), total: count, summary: { startMs: 0, endMs: count },
          rows: { count: visible, keyAt: index => `span${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(4)),
            itemAt: index => ({ key: `span${index}`, value: { id: `span${index}`, name: `Tool ${index + 1}`,
              kind: 'tool', status: 'success', startMs: index, endMs: index + 1 },
              parentKey: null, level: 1, position: index + 1, setSize: count, childCount: 0, expanded: false, selected: false }),
          }, ...(visible && request.action.type === 'reveal' ? { focusIndex: Number(request.action.key.slice(4)) } : {}),
        };
      },
    };
    return html`<lr-agent-trace label="Million-span trace" .treeSource=${source}></lr-agent-trace>`;
  },
};
