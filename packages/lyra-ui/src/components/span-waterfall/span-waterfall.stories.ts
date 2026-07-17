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
  component: 'lyra-span-waterfall',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-span-waterfall style="max-width: 40rem" .spans=${spans}></lyra-span-waterfall>`,
};

export const HiddenAxis: Story = {
  render: () => html`<lyra-span-waterfall style="max-width: 40rem" .spans=${spans} hide-axis></lyra-span-waterfall>`,
};

export const BrushedWithTimeRange: Story = {
  render: () => {
    let vs = 0;
    let ve = 820;
    const getWaterfall = () =>
      document.getElementById('brushed-waterfall') as HTMLElement & { viewStartMs: number; viewEndMs: number };
    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:40rem">
        <lyra-time-range
          min="0"
          max="820"
          .start=${vs}
          .end=${ve}
          @lyra-input=${(e: CustomEvent<{ start: number; end: number }>) => {
            vs = e.detail.start;
            ve = e.detail.end;
            const el = getWaterfall();
            el.viewStartMs = vs;
            el.viewEndMs = ve;
          }}
        ></lyra-time-range>
        <lyra-span-waterfall id="brushed-waterfall" .spans=${spans} .viewStartMs=${vs} .viewEndMs=${ve}></lyra-span-waterfall>
      </div>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lyra-span-waterfall style="max-width: 40rem"></lyra-span-waterfall>`,
};

/** 320px container — rows stack to two lines (name above bar) below 480px. */
export const Narrow: Story = {
  render: () => html`<lyra-span-waterfall style="max-width: 320px" .spans=${spans}></lyra-span-waterfall>`,
};
