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
    ${['Connected', 'Imported', 'Calculated', 'Published'].map((item) => html`<span>${item}</span>`)}
  </lr-scroller>`,
};

export const WithoutScrollbarOrShadows: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`without-scrollbar` is the upstream spelling of Lyra\'s retained `hide-scrollbar` alias. `without-shadow` removes both overflow cues while leaving native scrolling and optional controls intact.',
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
