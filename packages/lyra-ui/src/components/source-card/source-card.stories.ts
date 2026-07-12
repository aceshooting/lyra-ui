import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './source-card.js';

const meta: Meta = {
  title: 'SourceCard',
  component: 'lyra-source-card',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-source-card source-id="doc-1" title="annual_report.pdf" page="12" style="max-width: 28rem;">
      <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
      <span slot="full"
        >Revenue grew 12% year over year, driven primarily by strong performance in the cloud
        infrastructure segment, which saw a 34% increase in customer adoption across enterprise
        accounts.</span
      >
    </lyra-source-card>
  `,
};

export const ExcerptOnly: Story = {
  render: () => html`
    <lyra-source-card source-id="doc-2" title="meeting_notes.txt" style="max-width: 28rem;">
      <span slot="excerpt">Team agreed to revisit the roadmap next quarter. No full text available.</span>
    </lyra-source-card>
  `,
};

export const WithHref: Story = {
  render: () => html`
    <lyra-source-card
      source-id="doc-3"
      title="spec.pdf"
      page="4"
      href="https://example.com/spec.pdf"
      style="max-width: 28rem;"
    >
      <span slot="excerpt">See section 4 for the full API contract.</span>
    </lyra-source-card>
  `,
};

export const NonNumericPage: Story = {
  render: () => html`
    <lyra-source-card source-id="doc-4" title="foreword.txt" page="iv" style="max-width: 28rem;">
      <span slot="excerpt">Page labels are rendered as-is, not parsed as numbers.</span>
    </lyra-source-card>
  `,
};

export const UntitledMinimal: Story = {
  render: () => html`<lyra-source-card source-id="doc-5" style="max-width: 28rem;"></lyra-source-card>`,
};

export const Interactive: Story = {
  render: () => html`
    <div>
      <lyra-source-card
        source-id="doc-1"
        title="annual_report.pdf"
        page="12"
        href="https://example.com/a.pdf"
        style="max-width: 28rem;"
        @lyra-open=${(e: Event) => {
          const log = document.getElementById('source-card-log');
          if (log) log.textContent = `lyra-open: ${JSON.stringify((e as CustomEvent).detail)}`;
        }}
        @lyra-expand=${(e: Event) => {
          const log = document.getElementById('source-card-log');
          if (log) log.textContent = `lyra-expand: ${JSON.stringify((e as CustomEvent).detail)}`;
        }}
      >
        <span slot="excerpt">Revenue grew 12% year over year.</span>
        <span slot="full">Revenue grew 12% year over year, driven primarily by cloud adoption.</span>
      </lyra-source-card>
      <p id="source-card-log" style="font-size: 0.8125rem; color: var(--lyra-color-text-quiet);">
        Click the title or "Show more" — events fire here.
      </p>
    </div>
  `,
};
