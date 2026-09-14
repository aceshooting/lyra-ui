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

export const DensityAndChrome: Story = {
  name: 'compact + frame="plain"',
  render: () => html`
    <div style="display:grid; gap:1rem; max-width: 28rem;">
      <lr-source-card source-id="d1" title="annual_report.pdf" page="12">
        <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
      </lr-source-card>
      <lr-source-card compact source-id="d2" title="annual_report.pdf" page="13">
        <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
      </lr-source-card>
      <div
        style="border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); padding:0.5rem; display:grid; gap:0.5rem;"
      >
        <lr-source-card frame="plain" compact source-id="d3" title="meeting_notes.txt">
          <span slot="excerpt">Team agreed to revisit the roadmap next quarter.</span>
        </lr-source-card>
        <lr-source-card frame="plain" compact source-id="d4" title="spec.pdf" page="4">
          <span slot="excerpt">The retrieval pipeline chunks at 512 tokens with 64 of overlap.</span>
        </lr-source-card>
      </div>
    </div>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow long content (320px)',
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%;">
      <lr-source-card
        source-id="long-source"
        title="quarterly-report-with-an-unbroken-and-deliberately-very-long-filename-that-must-wrap.pdf"
        page="appendix-with-a-long-page-label"
      >
        <span slot="excerpt"
          >https://example.com/a/very/long/unbroken/source/path/that/must/remain/inside/the/card</span
        >
        <span slot="full"
          >A fully expanded source can contain a long human-readable passage as well as
          anUnbrokenEvidenceTokenThatMustWrapWithoutExpandingTheThreeHundredAndTwentyPixelAllocation.</span
        >
      </lr-source-card>
    </div>
  `,
};

export const RestingBackgroundToken: Story = {
  name: 'Retinting the resting frame',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-source-card-bg` is the resting companion to the `compact` tier\'s existing padding/gap levers, so a themed citation list no longer needs a `::part(base)` rule or an app-wide `--lr-color-surface` change.',
      },
    },
  },
  render: () => html`
    <lr-source-card
      source-id="doc-1"
      title="annual_report.pdf"
      page="12"
      style="max-width: 28rem; --lr-source-card-bg: var(--lr-color-brand-quiet)"
    >
      <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
    </lr-source-card>
  `,
};

export const Disabled: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`disabled` gates every self-rendered control, not just the title: both the title button and the "Show more" toggle render `disabled`, `lr-open`/`lr-expand` stop firing, neither stays in the tab order, and the card paints at `--lr-opacity-disabled`.',
      },
    },
  },
  render: () => html`
    <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12" disabled style="max-width: 28rem;">
      <span slot="excerpt">Revenue grew 12% year over year, driven primarily by...</span>
      <span slot="full">Revenue grew 12% year over year, driven primarily by strong performance.</span>
    </lr-source-card>
  `,
};

export const SelectedCitation: Story = {
  name: 'Single-select citations with aria-pressed',
  parameters: {
    docs: {
      description: {
        story:
          'A host `aria-pressed` or `aria-current` is forwarded onto the `title` button, the control that actually carries this card\'s action. The `toggle` button never receives it — it already owns `aria-expanded` for its own disclosure state.',
      },
    },
  },
  render: () => html`
    <div style="display:flex;flex-direction:column;gap:var(--lr-space-s);max-width:28rem;">
      <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12" aria-pressed="true">
        <span slot="excerpt">Revenue grew 12% year over year...</span>
      </lr-source-card>
      <lr-source-card source-id="doc-2" title="risk_register.pdf" page="4" aria-pressed="false">
        <span slot="excerpt">Supply chain exposure remains concentrated...</span>
      </lr-source-card>
    </div>
  `,
};
