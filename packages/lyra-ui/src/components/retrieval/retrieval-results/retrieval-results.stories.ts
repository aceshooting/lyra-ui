import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './retrieval-results.js';
import type { RetrievalChunk } from '../../../ai/types.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Retrieval Results',
  component: 'lr-retrieval-results',
};
export default meta;
type Story = StoryObj;

const chunks: RetrievalChunk[] = [
  {
    id: 'c1',
    text: 'Radium and polonium were both discovered by Marie and Pierre Curie in 1898, while studying the mineral pitchblende.',
    score: 0.92,
    source: { id: 's1', name: 'curie-bio.pdf' },
    metadata: { author: 'M. Curie', section: 'Discoveries' },
  },
  {
    id: 'c2',
    text: 'Marie Curie won the Nobel Prize in Physics in 1903 and Chemistry in 1911.',
    score: 0.6,
    source: { id: 's1', name: 'curie-bio.pdf' },
  },
  {
    id: 'c3',
    text: 'Unrelated background text about the periodic table of elements.',
    score: 0.2,
    source: { id: 's2', name: 'chemistry-101.pdf' },
  },
];

export const Default: Story = {
  render: () =>
    html`<lr-retrieval-results
      .chunks=${chunks}
      @lr-select=${(e: CustomEvent) => console.log('lr-select', e.detail)}
      @lr-chunk-open=${(e: CustomEvent) => console.log('lr-chunk-open', e.detail)}
    ></lr-retrieval-results>`,
};

export const Compact: Story = {
  render: () => html`<lr-retrieval-results presentation="compact" .chunks=${chunks}></lr-retrieval-results>`,
};

export const GroupedBySource: Story = {
  render: () => html`<lr-retrieval-results grouping="source" .chunks=${chunks}></lr-retrieval-results>`,
};

export const NotSelectable: Story = {
  render: () => html`<lr-retrieval-results .selectable=${false} .chunks=${chunks}></lr-retrieval-results>`,
};

export const Loading: Story = {
  render: () => html`<lr-retrieval-results loading></lr-retrieval-results>`,
};

export const LoadingMore: Story = {
  render: () => html`<lr-retrieval-results loading has-more .chunks=${chunks}></lr-retrieval-results>`,
};

export const HasMore: Story = {
  render: () =>
    html`<lr-retrieval-results
      has-more
      .chunks=${chunks}
      @lr-load-more=${() => console.log('lr-load-more')}
    ></lr-retrieval-results>`,
};

export const ErrorState: Story = {
  render: () => html`<lr-retrieval-results error="Retrieval failed. Please try again."></lr-retrieval-results>`,
};

export const Empty: Story = {
  render: () => html`<lr-retrieval-results></lr-retrieval-results>`,
};

export const Narrow: Story = {
  name: 'Narrow long content + states (320px)',
  render: () => html`
    <div style="display:grid; gap:1rem; inline-size:320px; max-inline-size:100%;">
      <lr-retrieval-results
        has-more
        .selectedIds=${['long-result']}
        .chunks=${[
          {
            id: 'long-result',
            text: 'UnbrokenRetrievedEvidenceTokenThatMustWrapInsideTheNarrowResultWithoutHorizontalOverflow plus a long explanatory passage.',
            score: 0.987,
            source: {
              id: 'long-source',
              name: 'source-with-a-deliberately-long-unbroken-filename-that-must-not-overflow.pdf',
            },
            metadata: {
              'a-deliberately-long-metadata-key': 'anUnbrokenMetadataValueThatMustRemainInsideTheRow',
            },
          },
        ] satisfies RetrievalChunk[]}
      ></lr-retrieval-results>
      <lr-retrieval-results loading></lr-retrieval-results>
      <lr-retrieval-results error="A long retrieval error remains contained in the narrow allocation."></lr-retrieval-results>
      <lr-retrieval-results></lr-retrieval-results>
    </div>
  `,
};

export const ThemedSelectedRow: Story = {
  name: 'Themed selected row (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-retrieval-results-selected-border` recolors the inline-start marker on a selected row without hijacking library-wide `--lr-color-brand`. Set it on the element or any ancestor — it is not declared on `:host`, so an ancestor value is never shadowed. Selection is marked with a border rather than a fill by design, so recoloring it can never push the row’s own text below its contrast floor.',
      },
    },
  },
  render: () => html`
    <lr-retrieval-results
      style="--lr-retrieval-results-selected-border: ${storyColor('warning')};"
      .chunks=${chunks}
      .selectedIds=${['c1']}
    ></lr-retrieval-results>
  `,
};
