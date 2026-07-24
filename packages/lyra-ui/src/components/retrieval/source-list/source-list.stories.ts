import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../source-card/source-card.js';
import './source-list.js';

const meta: Meta = {
  title: 'SourceList',
  component: 'lr-source-list',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-source-list label-plural="2 sources" style="max-width: 32rem;">
      <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12">
        <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
        <span slot="full"
          >Revenue grew 12% year over year, driven primarily by strong performance in the cloud
          infrastructure segment, which saw a 34% increase in customer adoption across enterprise
          accounts.</span
        >
      </lr-source-card>
      <lr-source-card source-id="doc-2" title="meeting_notes.txt">
        <span slot="excerpt">Team agreed to revisit the roadmap next quarter.</span>
      </lr-source-card>
    </lr-source-list>
  `,
};

export const ExpandedInitially: Story = {
  render: () => html`
    <lr-source-list label-plural="1 source" expanded style="max-width: 32rem;">
      <lr-source-card source-id="doc-1" title="notes.txt">
        <span slot="excerpt">Rendered already expanded.</span>
      </lr-source-card>
    </lr-source-list>
  `,
};

export const Empty: Story = {
  render: () => html`<lr-source-list style="max-width: 32rem;"></lr-source-list>`,
};

export const FallbackLabel: Story = {
  render: () => html`
    <lr-source-list label="Source" style="max-width: 32rem;">
      <lr-source-card source-id="doc-1" title="a.pdf">
        <span slot="excerpt">No label-plural set, so the plain label is used.</span>
      </lr-source-card>
    </lr-source-list>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <div>
      <lr-source-list
        label-plural="3 sources"
        style="max-width: 32rem;"
        @lr-toggle=${(e: Event) => {
          const log = document.getElementById('source-list-log');
          if (log) log.textContent = `lr-toggle: expanded=${(e as CustomEvent).detail.expanded}`;
        }}
      >
        <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12">
          <span slot="excerpt">Revenue grew 12% year over year.</span>
          <span slot="full">Revenue grew 12% year over year, driven primarily by cloud adoption.</span>
        </lr-source-card>
        <lr-source-card source-id="doc-2" title="meeting_notes.txt">
          <span slot="excerpt">Team agreed to revisit the roadmap next quarter.</span>
        </lr-source-card>
        <lr-source-card source-id="doc-3" title="spec.pdf" page="4" href="https://example.com/spec.pdf">
          <span slot="excerpt">See section 4 for the full API contract.</span>
        </lr-source-card>
      </lr-source-list>
      <p id="source-list-log" style="font-size: 0.8125rem; color: var(--lr-color-text-quiet);">
        Toggle the header — the event fires here.
      </p>
    </div>
  `,
};

export const NarrowAllStates: Story = {
  name: 'Narrow long content + states (320px)',
  render: () => html`
    <div style="display:grid; gap:1rem; inline-size:320px; max-inline-size:100%;">
      <lr-source-list label-plural="2 sources with deliberately long labels">
        <lr-source-card
          source-id="collapsed-long"
          title="collapsed-source-with-a-very-long-unbroken-filename-that-must-not-overflow.pdf"
        >
          <span slot="excerpt">Collapsed list state.</span>
        </lr-source-card>
      </lr-source-list>
      <lr-source-list label-plural="1 expanded source with long evidence" expanded>
        <lr-source-card
          source-id="expanded-long"
          title="expanded-source-with-a-very-long-unbroken-filename-that-must-not-overflow.pdf"
        >
          <span slot="excerpt"
            >UnbrokenExcerptTokenThatMustWrapInsideTheNarrowSourceListWithoutHorizontalScrolling.</span
          >
          <span slot="full">Long full evidence remains reachable from the card disclosure.</span>
        </lr-source-card>
      </lr-source-list>
      <lr-source-list label="Empty source list"></lr-source-list>
    </div>
  `,
};
