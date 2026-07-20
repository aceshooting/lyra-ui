import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraSpan } from '../trace-tree/span.js';

const spans: LyraSpan[] = [
  { id: 'root', name: 'Plan trip', kind: 'agent', startMs: 0, endMs: 820, status: 'success' },
  { id: 'search', parentId: 'root', name: 'web_search', kind: 'tool', startMs: 20, endMs: 260, status: 'success' },
  { id: 'llm', parentId: 'root', name: 'gpt-turbo', kind: 'llm', startMs: 270, endMs: 640, status: 'success' },
  { id: 'retrieve', parentId: 'llm', name: 'vector_lookup', kind: 'retriever', startMs: 300, endMs: 340, status: 'success' },
  { id: 'draft', parentId: 'root', name: 'draft_itinerary', kind: 'tool', startMs: 650, status: 'running' },
];

const meta: Meta = {
  title: 'Observability/Span Waterfall',
  component: 'lr-span-waterfall',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-span-waterfall style="max-width: 40rem" .spans=${spans}></lr-span-waterfall>`,
};

export const HiddenAxis: Story = {
  render: () => html`<lr-span-waterfall style="max-width: 40rem" .spans=${spans} hide-axis></lr-span-waterfall>`,
};

export const BrushedWithTimeRange: Story = {
  render: () => {
    let vs = 0;
    let ve = 820;
    const getWaterfall = () =>
      document.getElementById('brushed-waterfall') as HTMLElement & { viewStartMs: number; viewEndMs: number };
    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:40rem">
        <lr-time-range
          min="0"
          max="820"
          .start=${vs}
          .end=${ve}
          @lr-input=${(e: CustomEvent<{ start: number; end: number }>) => {
            vs = e.detail.start;
            ve = e.detail.end;
            const el = getWaterfall();
            el.viewStartMs = vs;
            el.viewEndMs = ve;
          }}
        ></lr-time-range>
        <lr-span-waterfall id="brushed-waterfall" .spans=${spans} .viewStartMs=${vs} .viewEndMs=${ve}></lr-span-waterfall>
      </div>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-span-waterfall style="max-width: 40rem"></lr-span-waterfall>`,
};

/** 320px container — rows stack to two lines (name above bar) below 480px. */
export const Narrow: Story = {
  render: () => html`<lr-span-waterfall style="max-width: 320px" .spans=${spans}></lr-span-waterfall>`,
};

export const RetintedActiveRow: Story = {
  name: 'Retinted active row',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-span-waterfall-row-active-bg` recolors the active (`activeSpanId`) row on its own. `::part(row)[data-active]` is invalid CSS, so without this property the active row could only be restyled by overriding the library-wide `--lr-color-brand-quiet` token. Unset, it renders exactly as before.',
      },
    },
  },
  render: () =>
    html`<lr-span-waterfall
      style="max-width: 40rem; --lr-span-waterfall-row-active-bg: var(--lr-color-success-quiet)"
      .spans=${spans}
      .activeSpanId=${'llm'}
    ></lr-span-waterfall>`,
};
