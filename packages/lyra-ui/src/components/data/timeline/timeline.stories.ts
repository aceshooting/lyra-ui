import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';
import '../../lr-timeline.js';
import '../../lr-timeline-item.js';
import type { LyraTimelineClusterActivateDetail } from './timeline.class.js';

const meta: Meta = {
  title: 'Timeline',
  component: 'lr-timeline',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-timeline aria-label="Deployment history">
      <lr-timeline-item variant="success">Deployment completed</lr-timeline-item>
      <lr-timeline-item variant="brand" active>Integration tests are running</lr-timeline-item>
      <lr-timeline-item>Build queued</lr-timeline-item>
    </lr-timeline>
  `,
};

export const OrderedSteps: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`ordered` renders an ordered list whose markers show the step number as real text, formatted for the effective locale; `start` sets the first number. With `reservations.css` loaded, the same markup has its rail, markers and numbers before the definitions load.',
      },
    },
  },
  render: () => html`
    <lr-timeline ordered aria-label="Permit application">
      <lr-timeline-item variant="success">Submit the form<span slot="timestamp">by 3 March</span></lr-timeline-item>
      <lr-timeline-item variant="brand" active>Pay the fee<span slot="timestamp">by 17 March</span><span slot="description">Within ten working days of the confirmation e-mail.</span></lr-timeline-item>
      <lr-timeline-item>Collect the permit<span slot="description">Bring the receipt and an identity document.</span></lr-timeline-item>
    </lr-timeline>
    <lr-timeline ordered start="4" aria-label="Permit application, continued" style="margin-block-start: var(--lr-space-l)">
      <lr-timeline-item>Register the change</lr-timeline-item>
      <lr-timeline-item>Archive the file</lr-timeline-item>
    </lr-timeline>
  `,
};

export const Horizontal: Story = {
  render: () => html`
    <lr-timeline orientation="horizontal" aria-label="Release stages">
      <lr-timeline-item variant="success">Build</lr-timeline-item>
      <lr-timeline-item variant="success">Test</lr-timeline-item>
      <lr-timeline-item variant="brand" active>Release</lr-timeline-item>
    </lr-timeline>
  `,
};

export const AutoOrientation: Story = {
  name: 'Auto orientation',
  parameters: {
    docs: {
      description: {
        story:
          '`orientation="auto"` measures the timeline and runs it as a row while every item gets about 10em of its inline size, and as a column otherwise. Narrow the canvas (or the resizable frame below) past that point and the same markup stacks; `effectiveOrientation` and the `data-effective-orientation` host attribute report the axis in effect.',
      },
    },
  },
  render: () => html`
    <div style="resize: horizontal; overflow: auto; inline-size: 40rem; max-inline-size: 100%; min-inline-size: 12rem; padding: var(--lr-space-s); border: var(--lr-border-width-thin) dashed var(--lr-color-border-subtle)">
      <lr-timeline orientation="auto" aria-label="Release stages">
        <lr-timeline-item variant="success">Build</lr-timeline-item>
        <lr-timeline-item variant="success">Test</lr-timeline-item>
        <lr-timeline-item variant="brand" active>Release</lr-timeline-item>
      </lr-timeline>
    </div>
  `,
};

export const HorizontalScrollingStrip: Story = {
  name: 'Horizontal strip narrow enough to scroll',
  parameters: {
    docs: {
      description: {
        story:
          'Timeline items are passive, so a horizontal strip is a scroll container with nothing tabbable inside it. While it genuinely overflows, `[part=\'base\']` rises from `tabindex="-1"` to `0` and shows a `::part(base):focus-visible` ring, so Tab reaches the strip and the arrow keys scroll it natively — otherwise every event past the edge would be pointer-only content. Widen the allocation past the content and the stop returns to `-1`, costing a keyboard user nothing.',
      },
    },
  },
  render: () => html`
    <div style="inline-size: 220px; max-inline-size: 100%;">
      <lr-timeline orientation="horizontal" aria-label="Release stages">
        <lr-timeline-item variant="success">Build queued behind 4820</lr-timeline-item>
        <lr-timeline-item variant="success">Integration tests green</lr-timeline-item>
        <lr-timeline-item variant="brand" active>Released to production</lr-timeline-item>
      </lr-timeline>
    </div>
  `,
};

export const ClusteredTimeScale: Story = {
  name: 'Clustered time scale',
  parameters: {
    docs: {
      description: {
        story:
          'Opt-in clustering replaces overlapping time-scaled items with a keyboard- and pointer-activatable count marker. The notification exposes the member timeline items; the consumer owns any popover or detail view.',
      },
    },
  },
  render: () => {
    const onClusterActivate = (
      event: CustomEvent<LyraTimelineClusterActivateDetail>
    ): void => {
      const timeline = event.currentTarget as HTMLElement;
      const output = timeline.nextElementSibling;
      if (output) {
        const labels = event.detail.items
          .map((item) => item.textContent?.trim())
          .filter((label): label is string => Boolean(label));
        output.textContent = `Cluster members: ${labels.join(', ')}`;
      }
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-m);">
        <lr-timeline
          scale="time"
          collision="cluster"
          aria-label="Company history"
          @lr-cluster-activate=${onClusterActivate}
        >
          <lr-timeline-item .timestamp=${new Date('2000-01-01T00:00:00Z')}
            >Company founded</lr-timeline-item
          >
          <lr-timeline-item .timestamp=${new Date('2000-01-02T00:00:00Z')}
            >First office opened</lr-timeline-item
          >
          <lr-timeline-item .timestamp=${new Date('2000-01-03T00:00:00Z')}
            >First customer signed</lr-timeline-item
          >
          <lr-timeline-item .timestamp=${new Date('2025-01-01T00:00:00Z')}
            >Global launch</lr-timeline-item
          >
        </lr-timeline>
        <p role="status" aria-live="polite">Activate the count marker to inspect its members.</p>
      </div>
    `;
  },
};

export const MarkerIconSlots: Story = {
  name: 'Marker icons',
  parameters: {
    docs: {
      description: {
        story: 'Use marker-icon for the purpose-named marker override. An empty slot falls back to the tone-colored dot.',
      },
    },
  },
  render: () => html`
    <lr-timeline aria-label="Marker icon examples">
      <lr-timeline-item variant="success">
        <span slot="marker-icon" aria-hidden="true">✓</span>
        Canonical marker icon
      </lr-timeline-item>
      <lr-timeline-item variant="brand">
        <span slot="marker-icon" aria-hidden="true">◆</span>
        Custom marker icon
      </lr-timeline-item>
    </lr-timeline>
  `,
};

export const AncestorThemeHooks: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Marker and rail hooks inherit through a theme wrapper while an item-level value can still override one item.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-timeline-marker-size: var(--lr-size-2rem); --lr-timeline-marker-color: var(--lr-color-brand); --lr-timeline-rail-width: var(--lr-size-0-25rem); --lr-timeline-rail-color: var(--lr-color-brand-quiet)"
    >
      <lr-timeline aria-label="Themed deployment history">
        <lr-timeline-item>Inherited marker</lr-timeline-item>
        <lr-timeline-item style="--lr-timeline-marker-color: var(--lr-color-success)">
          Direct item override
        </lr-timeline-item>
        <lr-timeline-item>Inherited marker again</lr-timeline-item>
      </lr-timeline>
    </div>
  `,
};

export const ThemedOrderedMarkers: Story = {
  render: () => html`
    <lr-timeline ordered aria-label="Release steps"
      style="--lr-timeline-ordered-marker-size: var(--lr-size-2rem); --lr-timeline-marker-warning-color: var(--lr-color-danger)">
      <lr-timeline-item variant="success">Build complete</lr-timeline-item>
      <lr-timeline-item variant="warning">Approval pending</lr-timeline-item>
    </lr-timeline>
  `,
};

export const NarrowLongContent: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Paired LTR/RTL allocations at the default 20rem (320px) contract cover vertical and horizontal timelines with localized and unbroken labels.',
      },
    },
  },
  render: () =>
    narrowStoryFrames((direction) => {
      const rtl = direction === 'rtl';
      const longLabel = rtl ? 'مرحلةنشرطويلةجداًوغيرقابلةللالتفاف' : 'SehrLangeNichtUmbrechbareBereitstellungsphase';
      return html`
        <div style="display: grid; gap: var(--lr-space-l); min-inline-size: 0;">
          <lr-timeline aria-label=${rtl ? 'سجل النشر العمودي' : 'Vertikaler Bereitstellungsverlauf'}>
            <lr-timeline-item variant="success">${longLabel}</lr-timeline-item>
            <lr-timeline-item variant="brand" active>
              ${rtl ? 'اختبارات التكامل قيد التشغيل' : 'Integrationsprüfungen werden ausgeführt'}
            </lr-timeline-item>
          </lr-timeline>
          <lr-timeline
            orientation="horizontal"
            aria-label=${rtl ? 'مراحل الإصدار الأفقية' : 'Horizontale Veröffentlichungsphasen'}
          >
            <lr-timeline-item variant="success">${longLabel}</lr-timeline-item>
            <lr-timeline-item variant="brand" active>
              ${rtl ? 'الإصدار النهائي' : 'Abschließende Veröffentlichung'}
            </lr-timeline-item>
          </lr-timeline>
        </div>
      `;
    }),
};

export const HorizontalTimeContentHeight: Story = {
  render: () => html`<div>
    <button type="button" @click=${(event: Event) => {
      const content = (event.currentTarget as HTMLElement).parentElement!.querySelector<HTMLElement>('[data-expandable]')!;
      content.textContent = content.textContent!.includes('Additional') ? 'Review' : 'Review: Additional details about the review, decisions, and follow-up work.';
    }}>Toggle event details</button>
    <lr-timeline orientation="horizontal" scale="time" collision="stack" aria-label="Project history">
      <lr-timeline-item .timestamp=${new Date('2024-01-01T00:00:00Z')}>Created</lr-timeline-item>
      <lr-timeline-item .timestamp=${new Date('2024-01-01T00:00:00Z')}><div data-expandable style="max-inline-size: var(--lr-size-8rem)">Review</div></lr-timeline-item>
      <lr-timeline-item .timestamp=${new Date('2025-01-01T00:00:00Z')}>Completed</lr-timeline-item>
    </lr-timeline>
  </div>`,
};

export const AlternatingWithOpposite: Story = {
  render: () => html`
    <lr-timeline marker-placement="alternate" label="Order history">
      <lr-timeline-item variant="success"><span slot="opposite">Mon 9:00</span>Order placed</lr-timeline-item>
      <lr-timeline-item variant="brand"><span slot="opposite">Tue 14:30</span>Packed</lr-timeline-item>
      <lr-timeline-item><span slot="opposite">Wed 8:10</span>Shipped</lr-timeline-item>
    </lr-timeline>
  `,
};

export const CenteredMarkers: Story = {
  render: () => html`
    <lr-timeline marker-alignment="center" label="Release steps">
      <lr-timeline-item><span slot="icon">1</span>Plan</lr-timeline-item>
      <lr-timeline-item><span slot="icon">2</span>Build</lr-timeline-item>
      <lr-timeline-item><span slot="icon">3</span>Ship</lr-timeline-item>
    </lr-timeline>
  `,
};
