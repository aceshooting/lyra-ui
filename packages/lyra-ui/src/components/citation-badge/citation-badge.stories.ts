import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './citation-badge.js';

const meta: Meta = {
  title: 'CitationBadge',
  component: 'lr-citation-badge',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An inline `[n]` citation marker with a hover/focus preview popover and confidence/verification coloring. Preview content is exposed as a `role="tooltip"` with a stable `aria-describedby` relationship whenever it exists. Fires `lr-citation-activate` on click/Enter and `lr-citation-open` on dblclick/Space — a consumer wires those to scrolling to (or fully opening) the matching source, typically a `<lr-source-card>` sharing the same `source-id`.',
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
      <lr-citation-badge index="1" status="verified" source-id="src-1"
        ><strong>report.pdf</strong>, p. 4 — "annual generation increased 12% over the prior
        period"</lr-citation-badge
      >, though panel degradation
      <lr-citation-badge index="2" status="high" source-id="src-2"
        ><strong>whitepaper.pdf</strong>, p. 2 — "typical degradation of 0.5%/year"</lr-citation-badge
      >
      remains within expected bounds. Regional estimates
      <lr-citation-badge index="3" status="medium" source-id="src-3"
        ><strong>regional-notes.md</strong> — "approximate figures, not independently audited"</lr-citation-badge
      >
      vary more, and one figure
      <lr-citation-badge index="4" status="low" source-id="src-4"
        ><strong>forum-post.html</strong> — a single unverified user comment</lr-citation-badge
      >
      is only weakly supported. A separate claim
      <lr-citation-badge index="5" status="unverified" source-id="src-5"
        >No source has confirmed this yet.</lr-citation-badge
      >
      hasn't been checked at all, and this last one
      <lr-citation-badge index="6" source-id="src-6">Plain citation, no confidence signal.</lr-citation-badge>
      carries no status.
    </p>
  `,
};

export const WithoutPreviewContent: Story = {
  name: 'No preview content (hover/focus does nothing)',
  render: () => html`
    <p>A bare citation with an empty default slot: <lr-citation-badge index="7" status="verified"></lr-citation-badge>.</p>
  `,
};

export const LabelOverride: Story = {
  name: 'Custom accessible-name override (label prop)',
  render: () => html`
    <p>
      Renders identically, but exposes a fully custom accessible name instead of the computed
      "Citation 8, verified":
      <lr-citation-badge
        index="8"
        status="verified"
        source-id="src-8"
        label="Source: quarterly-report.pdf, page 4"
        >quarterly-report.pdf, p. 4</lr-citation-badge
      >
    </p>
  `,
};

export const WithHref: Story = {
  name: 'With a direct href (carried in lr-citation-open, never navigated by the component itself)',
  render: () => html`
    <p>
      <lr-citation-badge index="9" status="verified" source-id="src-9" href="https://example.com/report.pdf#page=4"
        >report.pdf, p. 4</lr-citation-badge
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
        Click/Enter fires <code>lr-citation-activate</code>; dblclick/Space fires
        <code>lr-citation-open</code> (double-clicking also fires two paired activate events — see
        the component doc).
        <lr-citation-badge
          index="3"
          status="verified"
          source-id="src-3"
          href="https://example.com/report.pdf"
          @lr-citation-activate=${log}
          @lr-citation-open=${log}
          >report.pdf, p. 4 — "annual generation increased 12%"</lr-citation-badge
        >
      </p>
      <p id="citation-badge-log">No event fired yet.</p>
    </div>
  `,
};
