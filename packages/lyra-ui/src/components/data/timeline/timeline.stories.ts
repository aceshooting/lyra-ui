import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';
import './timeline.js';
import './timeline-item.js';
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

export const Horizontal: Story = {
  render: () => html`
    <lr-timeline orientation="horizontal" aria-label="Release stages">
      <lr-timeline-item variant="success">Build</lr-timeline-item>
      <lr-timeline-item variant="success">Test</lr-timeline-item>
      <lr-timeline-item variant="brand" active>Release</lr-timeline-item>
    </lr-timeline>
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
