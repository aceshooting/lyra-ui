import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { CompareVote } from './compare-panel.js';

const meta: Meta = {
  title: 'Observability/Compare Panel',
  component: 'lr-compare-panel',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-compare-panel style="max-width: 44rem" label-a="Model A" label-b="Model B" item-id="pair-1" sync-scroll>
      <p slot="prompt">What's the fastest way to sort a linked list?</p>
      <p slot="a">Merge sort is the standard choice for linked lists — O(n log n) with O(1) extra space.</p>
      <p slot="b">You could use quicksort, though in-place partitioning on a linked list is awkward.</p>
    </lr-compare-panel>
  `,
};

export const BlindThenRevealed: Story = {
  render: () => {
    const getPanel = () => document.getElementById('blind-panel') as HTMLElement & { labelA: string; labelB: string };
    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:44rem">
        <button
          @click=${() => {
            const el = getPanel();
            el.labelA = 'GPT-mini';
            el.labelB = 'Claude-lite';
          }}
        >
          Reveal model names
        </button>
        <lr-compare-panel id="blind-panel" item-id="pair-2">
          <p slot="a">Response from model A.</p>
          <p slot="b">Response from model B.</p>
        </lr-compare-panel>
      </div>
    `;
  },
};

export const StrictAbChoice: Story = {
  render: () => html`
    <lr-compare-panel style="max-width: 44rem" hide-tie hide-both-bad item-id="pair-3">
      <p slot="a">Answer A.</p>
      <p slot="b">Answer B.</p>
    </lr-compare-panel>
  `,
};

export const WithVoteLogging: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:1rem; max-width:44rem">
      <lr-compare-panel
        item-id="pair-4"
        @lr-vote=${(e: CustomEvent<{ choice: CompareVote; itemId: string }>) => console.log('vote', e.detail)}
      >
        <p slot="a">Answer A.</p>
        <p slot="b">Answer B.</p>
      </lr-compare-panel>
    </div>
  `,
};

/** 320px container — panes stack vertically below 640px. */
export const Narrow: Story = {
  render: () => html`
    <lr-compare-panel style="max-width: 320px" item-id="pair-5">
      <p slot="a">Answer A.</p>
      <p slot="b">Answer B.</p>
    </lr-compare-panel>
  `,
};
