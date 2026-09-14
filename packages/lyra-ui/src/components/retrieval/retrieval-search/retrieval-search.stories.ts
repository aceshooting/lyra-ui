import { html, nothing } from 'lit';
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
          'The query bar for a retrieval/RAG surface: query text, an active-filter/scope chip row, a vector/keyword/hybrid mode selector, and loading/error/empty status feedback. Fully controlled and network-free -- it only emits `lr-search`; when the host settles a later search as empty, the localized zero-result heading is announced politely without replaying initial or reconnect content.',
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
  name: 'Narrow long content + states (320px)',
  render: () =>
    html`<div style="display:grid; gap:1rem; inline-size:320px; max-inline-size:100%;">
      <lr-retrieval-search
        query="an intentionally long retrieval query that must wrap within a narrow allocation"
        .scope=${[
          'engineering-documents-with-a-very-long-unbroken-scope-name',
          'support-tickets',
          'release-notes',
        ]}
        .filters=${{
          'a-deliberately-long-filter-name': 'an-unbroken-filter-value-that-must-stay-contained',
          year: 2025,
        }}
      ></lr-retrieval-search>
      <lr-retrieval-search query="Long loading query" loading></lr-retrieval-search>
      <lr-retrieval-search
        query="Long error query"
        error-text="The retrieval service timed out while processing a deliberately long request."
      ></lr-retrieval-search>
      <lr-retrieval-search query="Long empty query" empty></lr-retrieval-search>
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

/** `size` puts the whole query row -- the query field, the mode selector and the submit button --
 *  on the library's one control ladder in a single setting, so the row keeps a shared baseline
 *  instead of one control moving alone. Both spellings of every tier are accepted. Leaving `size`
 *  unset keeps every composed control on its own `m` default, which is the row shown last, and the
 *  submit button keeps the shared tappable-target floor at every tier. */
export const SearchSizeTiers: Story = {
  name: 'Size tiers',
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-m); inline-size:520px; max-inline-size:100%;">
      ${(['s', 'm', 'l', undefined] as const).map(
        (size) => html`
          <lr-retrieval-search
            size=${size ?? nothing}
            query="inverter fault codes"
          ></lr-retrieval-search>
        `
      )}
    </div>
  `,
};

export const AnnounceOnMount: Story = {
  name: 'Announce on mount',
  parameters: {
    docs: {
      description: {
        story:
          'A search rendered in response to a query the user just ran should carry `announce`: the state it is already presenting when it first mounts is sent to the shared light-DOM sink once — `errorText` assertively, or the localized zero-result message politely. A search still `loading` has settled on neither state and announces nothing. Leave it off for a search that is part of the page being loaded; later transitions announce either way.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); inline-size: 520px; max-inline-size: 100%;">
      <button
        @click=${(event: Event) => {
          const host = (event.currentTarget as HTMLElement).parentElement!;
          const search = document.createElement('lr-retrieval-search');
          search.setAttribute('announce', '');
          search.setAttribute('query', 'inverter fault codes');
          search.setAttribute('empty', '');
          host.append(search);
        }}
      >
        Show a freshly mounted zero-result search
      </button>
      <lr-retrieval-search
        query="inverter fault codes"
        error-text="This one is part of the page and is deliberately not announced."
      ></lr-retrieval-search>
    </div>
  `,
};
