import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './retrieval-search.js';
import type { RetrievalQuery } from '../../../ai/types.js';

const meta: Meta = {
  title: 'Retrieval Search',
  component: 'lr-retrieval-search',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The query bar for a retrieval/RAG surface: query text, an active-filter/scope chip row, a vector/keyword/hybrid mode selector, and loading/error/empty status feedback. Fully controlled and network-free -- it only emits `lr-search` (a `RetrievalQuery` from `src/ai/types.ts`); the host performs the actual retrieval and toggles `loading` around it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () =>
    html`<lr-retrieval-search
      @lr-search=${(e: CustomEvent<RetrievalQuery>) => console.log('lr-search', e.detail)}
      @lr-cancel=${(e: CustomEvent) => console.log('lr-cancel', e.detail)}
    ></lr-retrieval-search>`,
};

export const WithActiveFiltersAndScope: Story = {
  name: 'With active filters and scope chips',
  render: () =>
    html`<lr-retrieval-search
      query="inverter fault codes"
      mode="vector"
      .scope=${['engineering-docs', 'support-tickets']}
      .filters=${{ type: 'pdf', year: 2025 }}
    ></lr-retrieval-search>`,
};

export const Loading: Story = {
  render: () => html`<lr-retrieval-search query="panel degradation curves" loading></lr-retrieval-search>`,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () =>
    html`<lr-retrieval-search
      query="panel degradation curves"
      error-text="The retrieval service timed out. Try again."
    ></lr-retrieval-search>`,
};

export const EmptyState: Story = {
  name: 'Empty (no results)',
  render: () => html`<lr-retrieval-search query="zzz-no-such-term" empty></lr-retrieval-search>`,
};

export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () =>
    html`<div style="max-width: 320px;">
      <lr-retrieval-search
        query="inverter fault codes"
        .scope=${['engineering-docs', 'support-tickets', 'release-notes']}
        .filters=${{ type: 'pdf', year: 2025 }}
      ></lr-retrieval-search>
    </div>`,
};

export const RightToLeft: Story = {
  name: 'RTL',
  render: () =>
    html`<div dir="rtl">
      <lr-retrieval-search
        query="أعطال العاكس"
        .scope=${['engineering-docs']}
        .filters=${{ type: 'pdf' }}
      ></lr-retrieval-search>
    </div>`,
};
