import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSpan } from './span.js';

const spans: LyraSpan[] = [
  { id: 'root', name: 'Plan trip', kind: 'agent', startMs: 0, endMs: 820, status: 'success' },
  {
    id: 'search',
    parentId: 'root',
    name: 'web_search',
    kind: 'tool',
    startMs: 20,
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
    endMs: 640,
    status: 'success',
    tokensIn: 640,
    tokensOut: 210,
    costText: '$0.0142',
  },
  { id: 'retrieve', parentId: 'llm', name: 'vector_lookup', kind: 'retriever', startMs: 300, endMs: 340, status: 'success' },
  { id: 'draft', parentId: 'root', name: 'draft_itinerary', kind: 'tool', startMs: 650, status: 'running' },
];

const meta: Meta = {
  title: 'Observability/Trace Tree',
  component: 'lr-trace-tree',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-trace-tree style="max-width: 40rem" .spans=${spans}></lr-trace-tree>`,
};

export const WithTokensAndCost: Story = {
  render: () => html`<lr-trace-tree style="max-width: 46rem" .spans=${spans} show-tokens show-cost></lr-trace-tree>`,
};

export const SyncedWithSelection: Story = {
  render: () => {
    let selected = 'llm';
    const getEl = () => document.getElementById('synced-trace-tree') as HTMLElement & { activeSpanId: string | null };
    return html`
      <lr-trace-tree
        id="synced-trace-tree"
        style="max-width: 40rem"
        .spans=${spans}
        active-span-id=${selected}
        @lr-span-select=${(e: CustomEvent<{ id: string }>) => {
          selected = e.detail.id;
          getEl().activeSpanId = selected;
        }}
      ></lr-trace-tree>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-trace-tree style="max-width: 40rem"></lr-trace-tree>`,
};

/** 320px container — tokens/cost hide first, then the duration bar. */
export const Narrow: Story = {
  render: () => html`<lr-trace-tree style="max-width: 320px" .spans=${spans} show-tokens show-cost></lr-trace-tree>`,
};

export const RetintedActiveRow: Story = {
  name: 'Retinted active row',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-trace-tree-row-active-bg` recolors the active (`activeSpanId`) row on its own. `::part(row)[data-active]` is invalid CSS, so without this property the active row could only be restyled by overriding the library-wide `--lr-color-brand-quiet` token. The active row is more than a tint: its secondary text (`detail`, `duration`, `tokens-in`, `tokens-out`, `cost`, and the `pending` status label) rises to full-strength `--lr-color-text`, and its semantic status labels are mixed 25% toward that text color, so everything on the row clears the WCAG AA 4.5:1 floor against the tint. That makes `--lr-trace-tree-row-active-bg` and `--lr-trace-tree-row-active-color` a pair, set together here: the defaults assume the active background stays on the same side of the lightness midpoint as the ambient surface, so a tint that crosses it — a loud fill in light mode — needs the matching text color set too, and its status-label tones re-checked against the new tint.',
      },
    },
  },
  render: () =>
    html`<lr-trace-tree
      style="max-width: 40rem; --lr-trace-tree-row-active-bg: var(--lr-color-success-quiet); --lr-trace-tree-row-active-color: var(--lr-color-text)"
      .spans=${spans}
      active-span-id="llm"
    ></lr-trace-tree>`,
};
