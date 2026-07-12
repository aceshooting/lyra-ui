import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../source-card/source-card.js';
import './source-list.js';

const meta: Meta = {
  title: 'SourceList',
  component: 'lyra-source-list',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-source-list label-plural="2 sources" style="max-width: 32rem;">
      <lyra-source-card source-id="doc-1" title="annual_report.pdf" page="12">
        <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
        <span slot="full"
          >Revenue grew 12% year over year, driven primarily by strong performance in the cloud
          infrastructure segment, which saw a 34% increase in customer adoption across enterprise
          accounts.</span
        >
      </lyra-source-card>
      <lyra-source-card source-id="doc-2" title="meeting_notes.txt">
        <span slot="excerpt">Team agreed to revisit the roadmap next quarter.</span>
      </lyra-source-card>
    </lyra-source-list>
  `,
};

export const ExpandedInitially: Story = {
  render: () => html`
    <lyra-source-list label-plural="1 source" expanded style="max-width: 32rem;">
      <lyra-source-card source-id="doc-1" title="notes.txt">
        <span slot="excerpt">Rendered already expanded.</span>
      </lyra-source-card>
    </lyra-source-list>
  `,
};

export const Empty: Story = {
  render: () => html`<lyra-source-list style="max-width: 32rem;"></lyra-source-list>`,
};

export const FallbackLabel: Story = {
  render: () => html`
    <lyra-source-list label="Source" style="max-width: 32rem;">
      <lyra-source-card source-id="doc-1" title="a.pdf">
        <span slot="excerpt">No label-plural set, so the plain label is used.</span>
      </lyra-source-card>
    </lyra-source-list>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <div>
      <lyra-source-list
        label-plural="3 sources"
        style="max-width: 32rem;"
        @lyra-toggle=${(e: Event) => {
          const log = document.getElementById('source-list-log');
          if (log) log.textContent = `lyra-toggle: expanded=${(e as CustomEvent).detail.expanded}`;
        }}
      >
        <lyra-source-card source-id="doc-1" title="annual_report.pdf" page="12">
          <span slot="excerpt">Revenue grew 12% year over year.</span>
          <span slot="full">Revenue grew 12% year over year, driven primarily by cloud adoption.</span>
        </lyra-source-card>
        <lyra-source-card source-id="doc-2" title="meeting_notes.txt">
          <span slot="excerpt">Team agreed to revisit the roadmap next quarter.</span>
        </lyra-source-card>
        <lyra-source-card source-id="doc-3" title="spec.pdf" page="4" href="https://example.com/spec.pdf">
          <span slot="excerpt">See section 4 for the full API contract.</span>
        </lyra-source-card>
      </lyra-source-list>
      <p id="source-list-log" style="font-size: 0.8125rem; color: var(--lyra-color-text-quiet);">
        Toggle the header — the event fires here.
      </p>
    </div>
  `,
};
