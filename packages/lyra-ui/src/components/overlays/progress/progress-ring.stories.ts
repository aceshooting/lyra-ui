import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './progress-ring.js';

const meta: Meta = { title: 'Feedback/Progress ring', component: 'lr-progress-ring', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-progress-ring value="65" show-value label="Upload progress">65%</lr-progress-ring>` };

/** The named label slot is the progress-bar-compatible alias for center content. */
export const LabelSlot: StoryObj = {
  render: () => html`
    <lr-progress-ring value="65"><span slot="label">Syncing</span></lr-progress-ring>
  `,
};

export const UpstreamThemeHooks: StoryObj = {
  render: () => html`
    <lr-progress-ring
      value="65"
      show-value
      label="Upload progress"
      style="--size:var(--lr-size-3rem);--track-width:var(--lr-border-width-medium);--indicator-width:var(--lr-size-4px);--track-color:var(--lr-color-brand-quiet);--indicator-color:var(--lr-color-success)"
    >65%</lr-progress-ring>
  `,
};

export const ThemeTrackWidth: StoryObj = {
  name: 'Theme track width',
  parameters: {
    docs: {
      description: {
        story:
          'Setting `--lr-theme-progress-ring-track-width` on `:root` or any ancestor retunes the track/indicator stroke width for every `lr-progress-ring` beneath it. It is a dedicated, opt-in hook: it stays unset by default whether or not `theme.css` is imported, so importing the theme alone can never repaint this ring away from its own `4px` default the way bridging the widely-shared `--lr-theme-border-width-thick` (declared at `3px` in `theme.css`) would have.',
      },
    },
  },
  render: () => html`
    <div style="--lr-theme-progress-ring-track-width: 8px;">
      <lr-progress-ring value="65" show-value label="Upload progress">65%</lr-progress-ring>
    </div>
  `,
};

export const ShowValue: StoryObj = {
  render: () => html`
    <div style="display:flex;gap:var(--lr-size-1rem);align-items:center">
      <lr-progress-ring value="65" aria-label="No percentage text"></lr-progress-ring>
      <lr-progress-ring value="65" show-value aria-label="Upload progress"></lr-progress-ring>
    </div>
  `,
};

export const SizeTiers: StoryObj = {
  name: 'Size tiers',
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) => html`<lr-progress-ring size=${size} value="65" aria-label=${size}></lr-progress-ring>`,
      )}
      <lr-progress-ring size="large" value="65" aria-label="large"></lr-progress-ring>
    </div>
  `,
};
