import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import type { RetrievalStage } from './retrieval-trace.class.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const stages: RetrievalStage[] = [
  {
    id: 'rewrite',
    kind: 'query-rewrite',
    startMs: 0,
    endMs: 60,
    status: 'success',
    evidence: { text: 'best hiking trails near Seattle with waterfalls' },
  },
  {
    id: 'embed',
    kind: 'embed',
    startMs: 60,
    endMs: 110,
    status: 'success',
    evidence: { metadata: { model: 'text-embedding-3-large', dimensions: 3072 } },
  },
  {
    id: 'retrieve',
    kind: 'retrieve',
    startMs: 110,
    endMs: 240,
    status: 'success',
    detail: '2 chunks',
    evidence: {
      chunks: [
        { id: 'c1', text: 'Mount Si is a popular day hike near North Bend with a steep final mile.', score: 0.91, source: { id: 's1', name: 'trail-guide.pdf' } },
        { id: 'c2', text: 'Rattlesnake Ledge offers sweeping views of Rattlesnake Lake.', score: 0.84, source: { id: 's2', name: 'trail-guide.pdf' } },
      ],
    },
  },
  {
    id: 'rerank',
    kind: 'rerank',
    startMs: 240,
    endMs: 280,
    status: 'success',
    detail: 'cross-encoder',
    evidence: { metadata: { model: 'bge-reranker-large' } },
  },
  {
    id: 'filter',
    kind: 'filter',
    startMs: 280,
    endMs: 300,
    status: 'success',
    evidence: { metadata: { minScore: 0.5 } },
  },
];

const runningStages: RetrievalStage[] = [
  ...stages.slice(0, 3),
  { id: 'rerank-running', kind: 'rerank', startMs: 240, status: 'running' },
];

const meta: Meta = {
  title: 'Retrieval/Retrieval Trace',
  component: 'lr-retrieval-trace',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-retrieval-trace style="max-width: 40rem" .stages=${stages}></lr-retrieval-trace>`,
};

export const InProgress: Story = {
  render: () => html`<lr-retrieval-trace style="max-width: 40rem" .stages=${runningStages}></lr-retrieval-trace>`,
};

export const SyncedWithSelection: Story = {
  render: () => {
    let selected: string | null = null;
    const getEl = () => document.getElementById('synced-retrieval-trace') as HTMLElement & { activeStageId: string | null };
    return html`
      <lr-retrieval-trace
        id="synced-retrieval-trace"
        style="max-width: 40rem"
        .stages=${stages}
        active-stage-id=${selected ?? nothing}
        @lr-stage-select=${(e: CustomEvent<{ id: string }>) => {
          selected = e.detail.id;
          getEl().activeStageId = selected;
        }}
      ></lr-retrieval-trace>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-retrieval-trace style="max-width: 40rem"></lr-retrieval-trace>`,
};

/** 320px container — responsive rules and long evidence/metadata wrapping are visible together. */
export const Narrow: Story = {
  name: 'Narrow long content (320px)',
  render: () => html`
    <lr-retrieval-trace
      style="inline-size:320px; max-inline-size:100%"
      active-stage-id="rewrite"
      .stages=${[
        {
          ...stages[0]!,
          evidence: {
            text: 'UnbrokenRewrittenQueryEvidenceThatMustWrapInsideTheNarrowTraceWithoutHorizontalOverflow',
            metadata: {
              'a-deliberately-long-metadata-key': 'anUnbrokenMetadataValueThatMustRemainContained',
            },
          },
        },
        ...runningStages.slice(1),
      ] satisfies RetrievalStage[]}
    ></lr-retrieval-trace>
  `,
};

export const ThemedActiveEvidence: Story = {
  name: 'Themed active evidence row (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-retrieval-trace-active-border` recolors the evidence row whose stage matches `active-stage-id`, leaving every other `--lr-color-brand` surface alone. Set it on the element or any ancestor — it is not declared on `:host`, so an ancestor value is never shadowed.',
      },
    },
  },
  render: () => html`
    <lr-retrieval-trace
      style="max-width: 40rem; --lr-retrieval-trace-active-border: ${storyColor('warning')};"
      .stages=${stages}
      active-stage-id="rewrite"
    ></lr-retrieval-trace>
  `,
};
