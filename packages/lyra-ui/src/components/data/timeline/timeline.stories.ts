import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';
import './timeline.js';
import './timeline-item.js';

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

export const MarkerIconSlots: Story = {
  name: 'Canonical and legacy marker icons',
  parameters: {
    docs: {
      description: {
        story:
          'Use marker-icon for the purpose-named marker override. The shipped icon slot remains a permanent fallback, and marker-icon takes precedence if both are filled.',
      },
    },
  },
  render: () => html`
    <lr-timeline aria-label="Marker icon compatibility">
      <lr-timeline-item variant="success">
        <span slot="marker-icon" aria-hidden="true">✓</span>
        Canonical marker icon
      </lr-timeline-item>
      <lr-timeline-item variant="brand">
        <span slot="icon" aria-hidden="true">◆</span>
        Legacy icon fallback
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
