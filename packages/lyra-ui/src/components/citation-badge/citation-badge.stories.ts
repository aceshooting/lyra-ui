import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './citation-badge.js';

const meta: Meta = {
  title: 'CitationBadge',
  component: 'lyra-citation-badge',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An inline `[n]` citation marker with a hover/focus preview popover and confidence/verification coloring. Fires `lyra-citation-activate` on click/Enter and `lyra-citation-open` on dblclick/Space — a consumer wires those to scrolling to (or fully opening) the matching source, typically a `<lyra-source-card>` sharing the same `source-id`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Statuses: Story = {
  render: () => html`
    <p style="max-width:32rem; line-height:1.8;">
      Solar output rose 12% year-over-year
      <lyra-citation-badge index="1" status="verified" source-id="src-1"
        ><strong>report.pdf</strong>, p. 4 — "annual generation increased 12% over the prior
        period"</lyra-citation-badge
      >, though panel degradation
      <lyra-citation-badge index="2" status="high" source-id="src-2"
        ><strong>whitepaper.pdf</strong>, p. 2 — "typical degradation of 0.5%/year"</lyra-citation-badge
      >
      remains within expected bounds. Regional estimates
      <lyra-citation-badge index="3" status="medium" source-id="src-3"
        ><strong>regional-notes.md</strong> — "approximate figures, not independently audited"</lyra-citation-badge
      >
      vary more, and one figure
      <lyra-citation-badge index="4" status="low" source-id="src-4"
        ><strong>forum-post.html</strong> — a single unverified user comment</lyra-citation-badge
      >
      is only weakly supported. A separate claim
      <lyra-citation-badge index="5" status="unverified" source-id="src-5"
        >No source has confirmed this yet.</lyra-citation-badge
      >
      hasn't been checked at all, and this last one
      <lyra-citation-badge index="6" source-id="src-6">Plain citation, no confidence signal.</lyra-citation-badge>
      carries no status.
    </p>
  `,
};

export const WithoutPreviewContent: Story = {
  name: 'No preview content (hover/focus does nothing)',
  render: () => html`
    <p>A bare citation with an empty default slot: <lyra-citation-badge index="7" status="verified"></lyra-citation-badge>.</p>
  `,
};

export const LabelOverride: Story = {
  name: 'Custom accessible-name override (label prop)',
  render: () => html`
    <p>
      Renders identically, but exposes a fully custom accessible name instead of the computed
      "Citation 8, verified":
      <lyra-citation-badge
        index="8"
        status="verified"
        source-id="src-8"
        label="Source: quarterly-report.pdf, page 4"
        >quarterly-report.pdf, p. 4</lyra-citation-badge
      >
    </p>
  `,
};

export const WithHref: Story = {
  name: 'With a direct href (carried in lyra-citation-open, never navigated by the component itself)',
  render: () => html`
    <p>
      <lyra-citation-badge index="9" status="verified" source-id="src-9" href="https://example.com/report.pdf#page=4"
        >report.pdf, p. 4</lyra-citation-badge
      >
    </p>
  `,
};

function log(e: CustomEvent<{ sourceId: string; index: number; href?: string }>): void {
  const out = document.getElementById('citation-badge-log');
  if (out) out.textContent = `${e.type}: ${JSON.stringify(e.detail)}`;
}

export const Events: Story = {
  render: () => html`
    <div>
      <p>
        Click/Enter fires <code>lyra-citation-activate</code>; dblclick/Space fires
        <code>lyra-citation-open</code> (double-clicking also fires two paired activate events — see
        the component doc).
        <lyra-citation-badge
          index="3"
          status="verified"
          source-id="src-3"
          href="https://example.com/report.pdf"
          @lyra-citation-activate=${log}
          @lyra-citation-open=${log}
          >report.pdf, p. 4 — "annual generation increased 12%"</lyra-citation-badge
        >
      </p>
      <p id="citation-badge-log">No event fired yet.</p>
    </div>
  `,
};
