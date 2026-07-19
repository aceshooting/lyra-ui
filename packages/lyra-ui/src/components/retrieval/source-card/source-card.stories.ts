import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './source-card.js';

const meta: Meta = {
  title: 'SourceCard',
  component: 'lr-source-card',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12" style="max-width: 28rem;">
      <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
      <span slot="full"
        >Revenue grew 12% year over year, driven primarily by strong performance in the cloud
        infrastructure segment, which saw a 34% increase in customer adoption across enterprise
        accounts.</span
      >
    </lr-source-card>
  `,
};

export const ExcerptOnly: Story = {
  render: () => html`
    <lr-source-card source-id="doc-2" title="meeting_notes.txt" style="max-width: 28rem;">
      <span slot="excerpt">Team agreed to revisit the roadmap next quarter. No full text available.</span>
    </lr-source-card>
  `,
};

export const WithHref: Story = {
  render: () => html`
    <lr-source-card
      source-id="doc-3"
      title="spec.pdf"
      page="4"
      href="https://example.com/spec.pdf"
      style="max-width: 28rem;"
    >
      <span slot="excerpt">See section 4 for the full API contract.</span>
    </lr-source-card>
  `,
};

export const NonNumericPage: Story = {
  render: () => html`
    <lr-source-card source-id="doc-4" title="foreword.txt" page="iv" style="max-width: 28rem;">
      <span slot="excerpt">Page labels are rendered as-is, not parsed as numbers.</span>
    </lr-source-card>
  `,
};

export const UntitledMinimal: Story = {
  render: () => html`<lr-source-card source-id="doc-5" style="max-width: 28rem;"></lr-source-card>`,
};

export const Interactive: Story = {
  render: () => html`
    <div>
      <lr-source-card
        source-id="doc-1"
        title="annual_report.pdf"
        page="12"
        href="https://example.com/a.pdf"
        style="max-width: 28rem;"
        @lr-open=${(e: Event) => {
          const log = document.getElementById('source-card-log');
          if (log) log.textContent = `lr-open: ${JSON.stringify((e as CustomEvent).detail)}`;
        }}
        @lr-expand=${(e: Event) => {
          const log = document.getElementById('source-card-log');
          if (log) log.textContent = `lr-expand: ${JSON.stringify((e as CustomEvent).detail)}`;
        }}
      >
        <span slot="excerpt">Revenue grew 12% year over year.</span>
        <span slot="full">Revenue grew 12% year over year, driven primarily by cloud adoption.</span>
      </lr-source-card>
      <p id="source-card-log" style="font-size: 0.8125rem; color: var(--lr-color-text-quiet);">
        Click the title or "Show more" — events fire here.
      </p>
    </div>
  `,
};
