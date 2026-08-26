import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './scroller.js';

const meta: Meta = { title: 'Layout/Scroller', component: 'lr-scroller' };
export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The logical start/end shadows follow the measured scroll edges. Scroll the row to see each cue disappear at its own edge; the same parts and behavior mirror under RTL.',
      },
    },
  },
  render: () => html`<lr-scroller controls label="Project cards" style="max-inline-size: 28rem;">
    ${['Solar', 'Wind', 'Battery', 'Forecast', 'Maintenance'].map((item) => html`<span style="display:inline-block; padding: var(--lr-space-l); background: var(--lr-color-brand-quiet);">${item}</span>`)}
  </lr-scroller>`,
};

export const Vertical: Story = {
  render: () => html`<lr-scroller orientation="vertical" controls label="Recent events" style="max-block-size: 12rem;">
    ${Array.from({ length: 24 }, (_, index) => html`<span>Event ${index + 1}</span>`)}
  </lr-scroller>`,
};

export const WithoutScrollbarOrShadows: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`without-scrollbar` hides the native scrollbar while preserving scrolling. `without-shadow` removes both overflow cues while leaving native scrolling and optional controls intact.',
      },
    },
  },
  render: () => html`<lr-scroller
    controls
    without-scrollbar
    without-shadow
    label="Projects without visual overflow chrome"
    style="max-inline-size:28rem;"
  >
    ${['Solar', 'Wind', 'Battery', 'Forecast', 'Maintenance'].map(
      (item) => html`<span
        style="display:inline-block; padding:var(--lr-space-l); background:var(--lr-color-brand-quiet);"
      >${item}</span>`,
    )}
  </lr-scroller>`,
};

export const ShadowTheme: Story = {
  render: () => html`<lr-scroller
    label="Themed overflow cues"
    style="max-inline-size:28rem; --shadow-size:var(--lr-size-3rem); --shadow-color:var(--lr-color-brand-quiet);"
  >
    ${['Solar', 'Wind', 'Battery', 'Forecast', 'Maintenance'].map(
      (item) => html`<span style="display:inline-block; padding:var(--lr-space-l);">${item}</span>`,
    )}
  </lr-scroller>`,
};

export const NarrowLongContent: Story = {
  name: 'Narrow long content LTR/RTL (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Each exact 320px allocation keeps both scroll controls inside the component while deliberately wide, unbroken cards remain reachable through the native logical scroll viewport in LTR and RTL.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
            <lr-scroller controls label=${direction === 'rtl' ? 'بطاقات المشاريع' : 'Project cards'} style="inline-size: 100%;">
              <span style="display: inline-block; padding: var(--lr-space-l); background: var(--lr-color-brand-quiet);"
                >${direction === 'rtl'
                  ? 'بطاقةمشروعمحليةطويلةجداًبدونأيفرصةللفصلالتلقائي'
                  : 'InternationalizedScrollerCardWithoutAnyNaturalBreakOpportunity'}</span
              >
              <span style="display: inline-block; padding: var(--lr-space-l); background: var(--lr-color-success-quiet);"
                >${direction === 'rtl'
                  ? 'بطاقةمشروعثانيةمحليةطويلةجداًبدونأيفرصةللفصلالتلقائي'
                  : 'InternationalizedSecondaryScrollerCardWithoutAnyNaturalBreakOpportunity'}</span
              >
            </lr-scroller>
          </div>
        `,
      )}
    </div>
  `,
};
